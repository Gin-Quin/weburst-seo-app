import { getUserById } from "$lib/server/users";
import { MCP_SCOPE, getMcpResourceMetadataUrl, getMcpServerUrl } from "$lib/server/mcp/config";
import { getMcpTokenExpirySeconds, resolveMcpPrincipal } from "$lib/server/mcp/auth";
import { validateMcpRequestOrigin, withMcpCors } from "$lib/server/mcp/http";
import { createWeburstMcpServer } from "$lib/server/mcp/server";
import {
	OAuthError,
	OAuthErrorCode,
	createMcpHandler,
	requireBearerAuth,
} from "@modelcontextprotocol/server";
import type { RequestHandler } from "./$types";

const handler = createMcpHandler(
	async ({ authInfo }) => {
		const userId = authInfo?.extra?.userId;
		if (typeof userId !== "string") throw new Error("Authenticated user is missing");
		const user = await getUserById(userId);
		if (!user) throw new Error("Authenticated user no longer exists");
		return createWeburstMcpServer(user);
	},
	{ responseMode: "json" },
);

const serve: RequestHandler = async ({ request, url }) => {
	const rejectedOrigin = validateMcpRequestOrigin(request);
	if (rejectedOrigin) return rejectedOrigin;

	const resource = getMcpServerUrl(url);
	const gate = requireBearerAuth({
		requiredScopes: [MCP_SCOPE],
		resourceMetadataUrl: getMcpResourceMetadataUrl(url).toString(),
		verifier: {
			async verifyAccessToken(token) {
				const principal = await resolveMcpPrincipal(token, resource.toString());
				if (!principal) {
					throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid or revoked token");
				}
				return {
					token,
					clientId: principal.token.clientId ?? "weburst-api-key",
					scopes: principal.token.scope.split(/\s+/).filter(Boolean),
					expiresAt: getMcpTokenExpirySeconds(principal.token),
					resource,
					extra: { userId: principal.user.id },
				};
			},
		},
	});
	const auth = await gate(request);
	if (auth instanceof Response) return withMcpCors(auth, request);
	return withMcpCors(await handler.fetch(request, { authInfo: auth }), request);
};

export const POST = serve;
export const GET = serve;
export const DELETE = serve;

export const OPTIONS: RequestHandler = async ({ request }) => {
	const rejectedOrigin = validateMcpRequestOrigin(request);
	if (rejectedOrigin) return rejectedOrigin;
	const headers = new Headers({
		"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
		"Access-Control-Allow-Headers":
			"Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
		"Access-Control-Max-Age": "86400",
	});
	const origin = request.headers.get("origin");
	if (origin) headers.set("Access-Control-Allow-Origin", origin);
	return new Response(null, { status: 204, headers });
};

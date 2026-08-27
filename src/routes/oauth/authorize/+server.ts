import { resolveMcpPrincipal, resolveSessionUser } from "$lib/server/mcp/auth";
import {
	OauthRequestError,
	createOauthAuthorizationRedirect,
	createOauthErrorRedirect,
	validateOauthAuthorizationRequest,
} from "$lib/server/mcp/oauth";
import { oauthErrorDescription, oauthErrorResponse, jsonResponse } from "$lib/server/mcp/http";
import { renderOauthAuthorizationPage } from "$lib/server/mcp/oauthPage";
import type { User } from "$lib/server/db/schema";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
	try {
		const authorization = await validateOauthAuthorizationRequest(url.searchParams, url);
		return new Response(renderOauthAuthorizationPage(authorization), {
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-store",
				"X-Frame-Options": "DENY",
				"Referrer-Policy": "no-referrer",
			},
		});
	} catch (error) {
		const code = error instanceof OauthRequestError ? error.code : "server_error";
		return new Response(`OAuth error: ${oauthErrorDescription(code)}`, {
			status: error instanceof OauthRequestError ? 400 : 500,
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
				"Cache-Control": "no-store",
			},
		});
	}
};

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const params = new URLSearchParams(await request.text());
		const authorization = await validateOauthAuthorizationRequest(params, url);
		if (params.get("action") === "deny") {
			return redirectPayload(
				createOauthErrorRedirect(authorization, "access_denied", url),
				request,
			);
		}

		const user = await resolveAuthorizingUser(request, params.get("api_key"));
		if (!user) return oauthErrorResponse("access_denied", 401);
		return redirectPayload(
			await createOauthAuthorizationRedirect(authorization, user, url),
			request,
		);
	} catch (error) {
		return oauthErrorResponse(
			error instanceof OauthRequestError ? error.code : "server_error",
			error instanceof OauthRequestError ? 400 : 500,
		);
	}
};

async function resolveAuthorizingUser(
	request: Request,
	apiKey: string | null,
): Promise<User | null> {
	const authorization = request.headers.get("authorization");
	const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
	if (bearer) {
		const sessionUser = await resolveSessionUser(bearer);
		if (sessionUser) return sessionUser;
		const mcpPrincipal = await resolveMcpPrincipal(bearer);
		if (mcpPrincipal) return mcpPrincipal.user;
	}
	if (!apiKey) return null;
	return (await resolveMcpPrincipal(apiKey.trim()))?.user ?? null;
}

function redirectPayload(redirect: string, request: Request): Response {
	if (request.headers.get("accept")?.includes("application/json")) {
		return jsonResponse({ redirect });
	}
	return Response.redirect(redirect, 302);
}

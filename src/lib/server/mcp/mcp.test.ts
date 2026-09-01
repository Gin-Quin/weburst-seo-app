import { describe, expect, mock, test } from "bun:test";
import { MCP_CLIENT_METADATA_DOCUMENT_SUPPORTED } from "./config";
import { hashMcpSecret, verifyPkceChallenge } from "./crypto";
import { ClientMetadataError, validateClientMetadataDocument } from "./clientMetadata";
import { renderOauthAuthorizationPage } from "./oauthPage";
import { canReadMcpClients } from "./permissions";
import { isSafeRedirectUri } from "./redirect";

describe("MCP authentication primitives", () => {
	test("hashes keys deterministically without retaining the clear text", async () => {
		const hash = await hashMcpSecret("wb_mcp_example");
		expect(hash).toHaveLength(64);
		expect(hash).toBe(await hashMcpSecret("wb_mcp_example"));
		expect(hash).not.toContain("example");
	});

	test("validates an S256 PKCE verifier", async () => {
		const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
		const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
		expect(await verifyPkceChallenge(verifier, challenge)).toBe(true);
		expect(await verifyPkceChallenge(`${verifier}x`, challenge)).toBe(false);
	});

	test("allows HTTPS and loopback OAuth redirects only", () => {
		expect(isSafeRedirectUri("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
		expect(isSafeRedirectUri("http://127.0.0.1:34123/callback")).toBe(true);
		expect(isSafeRedirectUri("http://localhost:8080/callback")).toBe(true);
		expect(isSafeRedirectUri("http://example.com/callback")).toBe(false);
		expect(isSafeRedirectUri("javascript:alert(1)")).toBe(false);
	});
});

describe("MCP authorization", () => {
	test("exposes client data only to admins and project managers", () => {
		expect(canReadMcpClients("admin")).toBe(true);
		expect(canReadMcpClients("project_manager")).toBe(true);
		expect(canReadMcpClients("client")).toBe(false);
		expect(canReadMcpClients("user")).toBe(false);
	});
});

describe("MCP OAuth client metadata", () => {
	const clientId = "https://claude.ai/oauth/mcp-oauth-client-metadata";
	const redirectUri = "https://claude.ai/api/mcp/auth_callback";
	const metadata = {
		client_id: clientId,
		client_name: "Claude",
		redirect_uris: [redirectUri],
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		token_endpoint_auth_method: "none",
	};

	test("advertises and accepts Claude hosted client metadata", () => {
		expect(MCP_CLIENT_METADATA_DOCUMENT_SUPPORTED).toBe(true);
		expect(validateClientMetadataDocument(clientId, redirectUri, metadata)).toEqual({
			displayName: "Claude (claude.ai)",
			redirectUris: [redirectUri],
		});
	});

	test("rejects a metadata document that changes its identity or callback origin", () => {
		expect(() =>
			validateClientMetadataDocument(clientId, redirectUri, {
				...metadata,
				client_id: "https://attacker.example/client.json",
			}),
		).toThrow(ClientMetadataError);
		expect(() =>
			validateClientMetadataDocument(clientId, redirectUri, {
				...metadata,
				redirect_uris: ["https://attacker.example/callback"],
			}),
		).toThrow(ClientMetadataError);
	});

	test("accepts Claude Code loopback callbacks with an ephemeral port", () => {
		const codeClientId = "https://claude.ai/oauth/claude-code-client-metadata";
		expect(
			validateClientMetadataDocument(codeClientId, "http://127.0.0.1:45678/callback", {
				...metadata,
				client_id: codeClientId,
				client_name: "Claude Code",
				redirect_uris: ["http://127.0.0.1/callback", "http://localhost/callback"],
			}),
		).toEqual({
			displayName: "Claude Code (claude.ai)",
			redirectUris: ["http://127.0.0.1/callback", "http://localhost/callback"],
		});
	});
});

describe("MCP OAuth Claude compatibility", () => {
	const loadOauthModule = async () => {
		mock.module("$lib/server/db", () => ({ db: {} }));
		return import("./oauth");
	};

	test("advertises CIMD public-client support and bearer header authentication", async () => {
		const { getOauthMetadata, getProtectedResourceMetadata } = await loadOauthModule();
		const previousBaseUrl = process.env.PUBLIC_BASE_URL;
		process.env.PUBLIC_BASE_URL = "https://app.weburst.fr";
		try {
			const requestUrl = new URL("https://app.weburst.fr/mcp");
			const metadata = getOauthMetadata(requestUrl);
			expect(metadata).toMatchObject({
				issuer: "https://app.weburst.fr",
				token_endpoint_auth_methods_supported: ["none"],
				client_id_metadata_document_supported: true,
				code_challenge_methods_supported: ["S256"],
			});
			expect("authorization_response_iss_parameter_supported" in metadata).toBe(false);
			expect(getProtectedResourceMetadata(requestUrl)).toMatchObject({
				resource: "https://app.weburst.fr/mcp",
				authorization_servers: ["https://app.weburst.fr"],
				bearer_methods_supported: ["header"],
			});
		} finally {
			if (previousBaseUrl === undefined) delete process.env.PUBLIC_BASE_URL;
			else process.env.PUBLIC_BASE_URL = previousBaseUrl;
		}
	});

	test("does not add an iss parameter to Claude callback redirects", async () => {
		const { createOauthErrorRedirect } = await loadOauthModule();
		const redirect = createOauthErrorRedirect(
			{
				clientId: "https://claude.ai/oauth/mcp-oauth-client-metadata",
				clientName: "Claude",
				redirectUri: "https://claude.ai/api/mcp/auth_callback",
				codeChallenge: "A".repeat(43),
				scope: "weburst.read",
				resource: "https://app.weburst.fr/mcp",
				state: "state",
			},
			"access_denied",
		);
		const callback = new URL(redirect);
		expect(callback.searchParams.get("error")).toBe("access_denied");
		expect(callback.searchParams.get("state")).toBe("state");
		expect(callback.searchParams.has("iss")).toBe(false);
	});
});

describe("MCP OAuth authorization page", () => {
	test("posts to the declared form endpoint when controls shadow form.action", () => {
		const page = renderOauthAuthorizationPage({
			clientId: "client-id",
			clientName: "Claude",
			redirectUri: "https://claude.ai/api/mcp/auth_callback",
			codeChallenge: "A".repeat(43),
			scope: "weburst.read",
			resource: "https://app.weburst.fr/mcp",
			state: "state",
		});

		expect(page).toContain('form.getAttribute("action")');
		expect(page).not.toContain("fetch(form.action");
		expect(page).toContain('includes("application/json")');
		expect(page).toContain('fetch("/oauth/session"');
		expect(page).toContain('id="signed-in-email"');
		expect(page).toContain('id="api-key-fields" hidden');
		expect(page).toContain('id="authorize-button" type="submit" name="action" value="approve" disabled');
		expect(page).toContain('headers.Authorization = "Bearer " + session');
	});
});

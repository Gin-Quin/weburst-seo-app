import { describe, expect, test } from "bun:test";
import { hashMcpSecret, verifyPkceChallenge } from "./crypto";
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

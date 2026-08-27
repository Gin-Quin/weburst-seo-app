import { getPublicBaseUrl } from "./config";

export function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers);
	headers.set("Content-Type", "application/json; charset=utf-8");
	headers.set("Cache-Control", "no-store");
	headers.set("Access-Control-Allow-Origin", "*");
	return new Response(JSON.stringify(value), { ...init, headers });
}

export function oauthErrorResponse(error: string, status = 400): Response {
	return jsonResponse({ error, error_description: oauthErrorDescription(error) }, { status });
}

export function oauthErrorDescription(error: string): string {
	switch (error) {
		case "invalid_client":
			return "Le client OAuth est inconnu.";
		case "invalid_redirect_uri":
			return "L’adresse de retour OAuth n’est pas autorisée.";
		case "invalid_grant":
			return "Le code d’autorisation est invalide ou expiré.";
		case "invalid_scope":
			return "La permission OAuth demandée n’est pas disponible.";
		case "invalid_target":
			return "La ressource MCP demandée n’est pas valide.";
		case "access_denied":
			return "L’autorisation a été refusée.";
		default:
			return "La requête OAuth est invalide.";
	}
}

export function validateMcpRequestOrigin(request: Request): Response | null {
	const origin = request.headers.get("origin");
	if (!origin) return null;
	const base = getPublicBaseUrl(new URL(request.url));
	const allowed = new Set([base.origin, "https://chatgpt.com", "https://claude.ai"]);
	try {
		const candidate = new URL(origin);
		const isLocalDev =
			(base.hostname === "localhost" || base.hostname === "127.0.0.1") &&
			(candidate.hostname === "localhost" || candidate.hostname === "127.0.0.1");
		if (allowed.has(candidate.origin) || isLocalDev) return null;
	} catch {
		// Invalid origins are rejected below.
	}
	return jsonResponse({ error: "forbidden_origin" }, { status: 403 });
}

export function withMcpCors(response: Response, request: Request): Response {
	const headers = new Headers(response.headers);
	const origin = request.headers.get("origin");
	if (origin) headers.set("Access-Control-Allow-Origin", origin);
	headers.set("Vary", "Origin");
	headers.set(
		"Access-Control-Expose-Headers",
		"Mcp-Session-Id, MCP-Protocol-Version, WWW-Authenticate",
	);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

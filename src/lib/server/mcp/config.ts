export const MCP_SCOPE = "weburst.read";
export const MCP_SERVER_NAME = "WeBurst";
export const MCP_SERVER_VERSION = "1.1.0";

export function getPublicBaseUrl(requestUrl?: URL): URL {
	const configured = process.env.PUBLIC_BASE_URL?.trim();
	const url = new URL(configured || requestUrl?.origin || "http://localhost:5173");
	url.pathname = "/";
	url.search = "";
	url.hash = "";
	return url;
}

export function getMcpServerUrl(requestUrl?: URL): URL {
	return new URL("mcp", getPublicBaseUrl(requestUrl));
}

export function getMcpResourceMetadataUrl(requestUrl?: URL): URL {
	return new URL(".well-known/oauth-protected-resource/mcp", getPublicBaseUrl(requestUrl));
}

export function getOauthIssuerUrl(requestUrl?: URL): URL {
	const issuer = getPublicBaseUrl(requestUrl);
	issuer.pathname = issuer.pathname.replace(/\/$/, "");
	return issuer;
}

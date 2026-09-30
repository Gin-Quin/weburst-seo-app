export const CALLBACK_PATH = "/api/keywords/callback";

// cloudflared also prints https://api.trycloudflare.com/... when the tunnel request fails.
const TUNNEL_URL = /https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/;

export function extractTunnelUrl(output: string): string | undefined {
	return output.match(TUNNEL_URL)?.[0];
}

import { expect, test } from "bun:test";
import { extractTunnelUrl } from "./devTunnel";

test("extracts the quick tunnel URL from cloudflared output", () => {
	const output = `2026-09-30T10:00:00Z INF Requesting new quick Tunnel on trycloudflare.com...
2026-09-30T10:00:02Z INF +--------------------------------------------------------------------------------------------+
2026-09-30T10:00:02Z INF |  https://nirvana-animal-vanilla-friendly.trycloudflare.com                                 |`;
	expect(extractTunnelUrl(output)).toBe("https://nirvana-animal-vanilla-friendly.trycloudflare.com");
});

test("finds the URL when it arrives split across chunks only once complete", () => {
	expect(extractTunnelUrl("INF |  https://nirvana-animal-van")).toBeUndefined();
	expect(extractTunnelUrl("INF |  https://nirvana-animal-vanilla.trycloudflare.com |")).toBe(
		"https://nirvana-animal-vanilla.trycloudflare.com",
	);
});

test("ignores the trycloudflare API host printed in errors", () => {
	const output =
		'ERR Failed to request quick Tunnel error="Post \\"https://api.trycloudflare.com/tunnel\\": dial tcp: lookup api.trycloudflare.com"';
	expect(extractTunnelUrl(output)).toBeUndefined();
});

test("returns nothing without a URL", () => {
	expect(extractTunnelUrl("")).toBeUndefined();
	expect(extractTunnelUrl("INF Registered tunnel connection connIndex=0")).toBeUndefined();
});

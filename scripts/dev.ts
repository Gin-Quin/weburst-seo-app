// `bun dev`: starts a cloudflared quick tunnel, then Vite with the DataForSEO postback URL pointing
// at it. DataForSEO delivers results by postback and cannot reach localhost.
// Use `bun dev --no-tunnel` (or `bun run dev:plain`) to skip the tunnel.
import { CALLBACK_PATH, extractTunnelUrl } from "./devTunnel";

const PORT = 3857; // keep in sync with vite.config.ts
const TUNNEL_TIMEOUT_MS = 30_000;

const args = process.argv.slice(2);
const viteArgs = args.filter((arg) => arg !== "--no-tunnel");

const spawnTunnel = () =>
	Bun.spawn(["cloudflared", "tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`], {
		stdout: "ignore",
		stderr: "pipe",
	});

async function startTunnel(): Promise<{ process: ReturnType<typeof spawnTunnel>; url: string } | undefined> {
	let tunnel: ReturnType<typeof spawnTunnel>;
	try {
		tunnel = spawnTunnel();
	} catch {
		console.warn("[dev] cloudflared is not installed (brew install cloudflared): starting without a tunnel.");
		return undefined;
	}

	const url = await new Promise<string | undefined>((resolve) => {
		const timer = setTimeout(() => resolve(undefined), TUNNEL_TIMEOUT_MS);
		tunnel.exited.then(() => resolve(undefined));
		void (async () => {
			const decoder = new TextDecoder();
			let output = "";
			let found = false;
			// Keep draining stderr for the life of the tunnel, or cloudflared blocks on a full pipe.
			for await (const chunk of tunnel.stderr) {
				const text = decoder.decode(chunk);
				if (found) {
					if (/\bERR\b/.test(text)) console.error(`[tunnel] ${text.trim()}`);
					continue;
				}
				output += text;
				const match = extractTunnelUrl(output);
				if (match) {
					found = true;
					clearTimeout(timer);
					resolve(match);
				}
			}
		})();
	});

	if (!url) {
		tunnel.kill();
		console.warn("[dev] Could not start the tunnel: starting without it.");
		return undefined;
	}
	return { process: tunnel, url };
}

const tunnel = args.includes("--no-tunnel") ? undefined : await startTunnel();
const env: Record<string, string | undefined> = { ...process.env };
if (tunnel) {
	env.DATA_FOR_SEO_SERP_POSTBACK_URL = tunnel.url + CALLBACK_PATH;
	console.log(`[dev] DataForSEO postbacks: ${env.DATA_FOR_SEO_SERP_POSTBACK_URL}`);
} else {
	console.warn("[dev] No tunnel: starting a keyword analysis will fail unless DATA_FOR_SEO_SERP_POSTBACK_URL is set.");
}

const vite = Bun.spawn(["bun", "--bun", "vite", "dev", ...viteArgs], {
	env,
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
});
tunnel?.process.exited.then(() => {
	if (vite.exitCode === null) console.error("[dev] The tunnel stopped: DataForSEO results will no longer arrive.");
});
process.on("exit", () => tunnel?.process.kill());
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => vite.kill(signal));

process.exit(await vite.exited);

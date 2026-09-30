import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: 3857,
		// Quick tunnel used to receive DataForSEO postbacks locally.
		allowedHosts: [".trycloudflare.com"],
	},
	preview: {
		port: 3857,
	},
	optimizeDeps: {
		exclude: ["phosphor-icons-svelte"],
	},
	ssr: {
		external: ["bun"],
		// Production only receives build/, without node_modules. Bundle the AI
		// SDK and its schema dependency instead of relying on Bun auto-install.
		noExternal: ["ai", /^@ai-sdk\//, "zod"],
	},
});

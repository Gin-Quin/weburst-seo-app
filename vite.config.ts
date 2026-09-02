import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: 3857,
	},
	preview: {
		port: 3857,
	},
	optimizeDeps: {
		exclude: ["phosphor-icons-svelte"],
	},
	ssr: {
		external: ["bun"],
	},
});

<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import { onMount } from "svelte";
	import { Toaster } from "svelte-sonner";
	import "../app.css";

	let { children } = $props();

	onMount(() => {
		const originalFetch = window.fetch;

		globalThis.fetch = ((...args) => {
			const bearer = localStorage.getItem("bearer");

			if (bearer) {
				// If there's a bearer token, add the Authorization header
				const [url, init = {}] = args;
				const headers = new Headers(init.headers);
				headers.set("Authorization", `Bearer ${bearer}`);

				args[1] = {
					...init,
					headers,
				};
			}

			return originalFetch.apply(globalThis, args);
		}) as typeof globalThis.fetch;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Toaster />

<div class="root min-h-[100dvh] bg-base-300">
	{@render children?.()}
</div>

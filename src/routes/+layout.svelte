<script lang="ts">
	import favicon from "$lib/assets/favicon.png";
	import { Toaster } from "svelte-sonner";
	import "../app.css";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Toaster />

<div class="root min-h-[100dvh]! bg-base-300">
	{@render children?.()}
</div>

<script lang="ts">
	import { cubicIn } from "svelte/easing";
	import { fade } from "svelte/transition";

	let { children } = $props();

	let mounted = $state(false);

	$effect(() => {
		mounted = true;
	});
</script>

{#if mounted}
	<div in:fade={{ duration: 400, easing: cubicIn }}>
		{@render children()}
	</div>
{/if}

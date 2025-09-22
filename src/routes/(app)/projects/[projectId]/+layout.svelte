<script lang="ts">
	import { context } from "$lib/stores/context.svelte";
	import { projectContext } from "$lib/stores/projectContext.svelte";
	import { fade } from "svelte/transition";
	import AddKeywordsDialog from "./AddKeywordsDialog.svelte";

	let { children } = $props();
</script>

{#if context.project}
	<AddKeywordsDialog
		bind:openAddKeywordsDialog={projectContext.openKeywordsDialog}
	/>

	<div in:fade={{ duration: 300 }}>
		{@render children()}
	</div>
{/if}

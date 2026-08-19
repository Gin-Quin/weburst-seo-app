<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { canAccessClientPage } from "$lib/auth/clientPageAccess";
	import { context } from "$lib/stores/context.svelte";

	let { children } = $props();
	const hasAccess = $derived(
		context.user && context.clients
			? canAccessClientPage(
					context.user.role,
					page.params.clientId,
					context.clients.map(({ id }) => id),
				)
			: false,
	);

	$effect(() => {
		if (!context.user || !context.clients) return;
		if (!hasAccess && !context.isArchivingClient) {
			void goto("/projects", { replaceState: true });
		}
	});
</script>

{#if hasAccess}
	{@render children()}
{/if}

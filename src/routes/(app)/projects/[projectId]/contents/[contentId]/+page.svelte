<script lang="ts">
	import { page } from "$app/state";
	import Loader from "$lib/components/Loader.svelte";
	import { getContent } from "../../../../../api/contents/contents.remote";
	import EditorWorkspace from "../components/EditorWorkspace.svelte";

	const contentQuery = getContent({ projectId: page.params.projectId!, id: page.params.contentId! });
</script>

<svelte:head><title>Édition du contenu</title></svelte:head>

{#await contentQuery}
	<div class="center min-h-[60dvh]"><Loader /></div>
{:then content}
	<EditorWorkspace initialContent={content} />
{:catch error}
	<div class="center min-h-[60dvh] col gap-2"><h1 class="text-2xl bold">Contenu introuvable</h1><p class="text-light">{error instanceof Error ? error.message : "Le contenu n’a pas pu être chargé."}</p></div>
{/await}

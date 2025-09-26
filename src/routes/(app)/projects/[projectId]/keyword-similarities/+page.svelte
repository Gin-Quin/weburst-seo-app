<script lang="ts">
	import Loader from "$lib/components/Loader.svelte";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import SectionClusters from "./SectionClusters.svelte";
	import { projectContext } from "$lib/stores/projectContext.svelte";

	const content = defineContent({
		en: {
			addKeywords: "Add Keywords",
			noAnalysisResults:
				"No data available. Add keywords and start an analysis.",
		},
		fr: {
			addKeywords: "Ajouter des mots-clés",
			noAnalysisResults:
				"Aucune donnée disponible. Ajoutez des mots-clés et lancez une analyse.",
		},
	});
</script>

{#await projectContext.keywordClustersQuery}
	<Loader />
{:then clusters}
	{#if clusters == null}
		<div class="center text-xl text-light bold">
			{$content.noAnalysisResults}
		</div>
	{:else}
		<SectionClusters {clusters} />
		<!-- <SectionUrlAnalysis /> -->
	{/if}
{/await}

<script lang="ts">
	import Loader from "$lib/components/Loader.svelte";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { AggregatedKeywordAnalysisData } from "$lib/server/clickhouse/services/keywords";
	import { context } from "$lib/stores/context.svelte";
	import { projectContext } from "$lib/stores/projectContext.svelte";
	import { SvelteSet } from "svelte/reactivity";
	import SectionCompetitiveMapping from "./SectionCompetitiveMapping.svelte";
	import SectionLeaders from "./SectionLeaders.svelte";
	import SectionPotential from "./SectionPotential.svelte";
	import SectionShareOfVoice from "./SectionShareOfVoice.svelte";

	const content = defineContent({
		en: {
			startAnalysis: "Start new Analysis",
			confirmStartAnalysis: "Do you want to start a new analysis?",
			noAnalysisResults:
				"No data available. Add keywords and start an analysis.",
		},
		fr: {
			startAnalysis: "Lancer une analyse",
			confirmStartAnalysis: "Voulez-vous lancer une nouvelle analyse&nbsp;?",
			noAnalysisResults:
				"Aucune donnée disponible. Ajoutez des mots-clés et lancez une analyse.",
		},
	});

	let visibleDomains = new SvelteSet<string>([context.project!.domain]);
</script>

{#await projectContext.analysisResultsWithTrendQuery}
	<Loader />
{:then analysisResultsWithTrend}
	{console.log({ analysisResultsWithTrend })}
	{#if analysisResultsWithTrend == null}
		<div class="center text-xl text-light bold">
			{$content.noAnalysisResults}
		</div>
	{:else}
		{@const client: AggregatedKeywordAnalysisData = analysisResultsWithTrend.data.find(
			(item) => item.domain === context.project!.domain,
		) ?? {
			domain: context.project!.domain,
			topThreeKeywordCount: 0,
			topTenKeywordCount: 0,
			positionnedKeywordCount: 0,
			volume: 0,
			trend: 0,
			analysisId: "",
			createdAt: new Date().toISOString()
		}}

		<div class="grid grid-cols-[1.4fr_1fr] gap-5">
			<SectionShareOfVoice
				{analysisResultsWithTrend}
				{visibleDomains}
				{client}
			/>
			<SectionLeaders {analysisResultsWithTrend} {visibleDomains} {client} />
		</div>

		<div class="grid grid-cols-[1fr_1.8fr] gap-5">
			<SectionPotential {analysisResultsWithTrend} {client} />
			<SectionCompetitiveMapping
				{analysisResultsWithTrend}
				{visibleDomains}
				{client}
			/>
		</div>
	{/if}
{:catch error}
	<div class="text-error bold">
		{String(error)}
	</div>
{/await}

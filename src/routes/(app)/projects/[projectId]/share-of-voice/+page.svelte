<script lang="ts">
	import Loader from "$lib/components/Loader.svelte";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { getDefaultVisibleDomains } from "$lib/keywords/getDefaultVisibleDomains";
	import { extractHost } from "$lib/keywords/serpAnalytics";
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

	const projectDomain = extractHost(context.project!.domain);
</script>

{#await projectContext.analysisResultsWithTrendQuery}
	<Loader />
{:then analysisResultsWithTrend}
	{#if analysisResultsWithTrend == null}
		<div class="center text-xl text-light bold">
			{$content.noAnalysisResults}
		</div>
	{:else}
		{@const visibleDomains = new SvelteSet(
			getDefaultVisibleDomains(
				analysisResultsWithTrend.data.map(({ domain }) => domain),
				projectDomain,
			),
		)}
		{@const client: AggregatedKeywordAnalysisData = analysisResultsWithTrend.data.find(
			(item) => item.domain === projectDomain,
		) ?? {
			domain: projectDomain,
			topThreeKeywordCount: 0,
			topTenKeywordCount: 0,
			positionnedKeywordCount: 0,
			volume: 0,
			trend: 0,
			analysisId: "",
			createdAt: new Date().toISOString()
		}}

		<div class="DashboardGrid DashboardGridPrimary">
			<SectionShareOfVoice
				{analysisResultsWithTrend}
				{visibleDomains}
				{client}
			/>
			<SectionLeaders {analysisResultsWithTrend} {visibleDomains} {client} />
		</div>

		<div class="DashboardGrid DashboardGridSecondary">
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

<style>
	.DashboardGrid {
		display: grid;
		gap: 1.25rem;
		min-width: 0;
	}

	.DashboardGridPrimary {
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
	}

	.DashboardGridSecondary {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.8fr);
	}

	.DashboardGrid > :global(*) {
		min-width: 0;
	}

	@media (max-width: 900px) {
		.DashboardGridPrimary,
		.DashboardGridSecondary {
			grid-template-columns: minmax(0, 1fr);
		}

		.DashboardGridPrimary > :global(.card) {
			height: 32rem;
		}

		.DashboardGridSecondary > :global(.card:last-child) {
			height: 32rem;
		}
	}
</style>

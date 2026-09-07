<script lang="ts">
	import CountChange from "$lib/components/CountChange.svelte";
	import { formatPercent } from "$lib/numbers/formatPercent";
	import { defineContent, locale } from "$lib/i18n/locale.svelte";
	import type {
		AggregatedKeywordAnalysis,
		AggregatedKeywordAnalysisData,
	} from "$lib/server/clickhouse/services/keywords";

	const content = defineContent({
		en: {
			title: "SEO Potential",
			description: "Estimated traffic from positions not yet exploited.",
			trafficPotential: "Traffic potential",
			targetedKeywordsLabel: "Number of targeted keywords",
			positionnedKeywordsTitle: "Positionned keywords",
			top3KeywordsTitle: "Top 3 keywords",
			changeSince: "Change since",
			noPrevious: "No previous analysis",
		},
		fr: {
			title: "Potentiel SEO",
			description:
				"Trafic SEO potentiel sur les positions pas encore exploitées.",
			trafficPotential: "Volume total de recherche",
			targetedKeywordsLabel: "Nombre de mots clés ciblés",
			positionnedKeywordsTitle: "Mots-clés positionnés",
			top3KeywordsTitle: "Mots-clés en top 3",
			changeSince: "Évolution depuis le",
			noPrevious: "Aucune analyse précédente",
		},
	});

	let {
		analysisResultsWithTrend,
		client,
	}: {
		analysisResultsWithTrend: AggregatedKeywordAnalysis;
		client: AggregatedKeywordAnalysisData;
	} = $props();

	const { totalVolume, keywordCount } = $derived(analysisResultsWithTrend);
	const volumeChange = $derived(analysisResultsWithTrend.searchVolumeChange);
	const changes = $derived(analysisResultsWithTrend.keywordCountChanges?.[client.domain]);
	const changeLabel = $derived(analysisResultsWithTrend.previousAnalysisAt
		? `${$content.changeSince} ${new Date(analysisResultsWithTrend.previousAnalysisAt).toLocaleDateString($locale)}`
		: $content.noPrevious);
</script>

<div class="card">
	<header>
		<div class="title">
			{$content.title}
		</div>
		<div class="description">
			{$content.description}
		</div>
	</header>

	<main class="col items-stretch gap-8 font-bold">
		<!-- Header -->
		<div class="col items-stretch gap-4 pt-2">
			<div class="center items-center justify-between">
				<h2 class="font-bold! text-lg! description">
					{$content.trafficPotential}
				</h2>
				<div class="center gap-2">
					<span class="text-xl font-bold">
						{totalVolume.toLocaleString("fr-FR")}
					</span>
					{#if volumeChange?.relative !== undefined}
						<span class="badge text-xs" class:badge-success={volumeChange.relative > 0} class:badge-warning={volumeChange.relative < 0} title={changeLabel}>
							{volumeChange.relative > 0 ? "+" : ""}{formatPercent(volumeChange.relative)}
						</span>
					{:else}
						<CountChange value={volumeChange?.absolute} label={changeLabel} />
					{/if}
				</div>
			</div>

			<!-- Progress bar -->
			<div class="w-full bg-gray-100 rounded-full h-2">
				<div
					class="bg-primary h-2 rounded-full"
					style:width="{totalVolume > 0 ? Math.min(100, (client.volume / totalVolume) * 100) : 0}%"
				></div>
			</div>
		</div>

		<!-- Keywords stats -->
		<div class="col items-stretch gap-4">
			<div class="center justify-between">
				<span class="">{$content.targetedKeywordsLabel}</span>
				<span class="text-xl">{keywordCount}</span>
			</div>
			<div class="center justify-between">
				<span class="">{$content.positionnedKeywordsTitle}</span>
				<span class="row items-center gap-2"><span class="text-xl">{client.positionnedKeywordCount}</span>
					<CountChange value={analysisResultsWithTrend.previousAnalysisAt ? changes?.positioned ?? 0 : undefined} label={changeLabel} />
				</span>
			</div>
			<div class="center justify-between">
				<span class="">{$content.top3KeywordsTitle}</span>
				<span class="row items-center gap-2"><span class="text-xl">{client.topThreeKeywordCount}</span>
					<CountChange value={analysisResultsWithTrend.previousAnalysisAt ? changes?.topThree ?? 0 : undefined} label={changeLabel} />
				</span>
			</div>
			<p class="text-xs text-light font-normal">{changeLabel}</p>
		</div>
	</main>
</div>

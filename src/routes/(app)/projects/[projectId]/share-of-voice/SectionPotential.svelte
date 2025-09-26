<script lang="ts">
	import Trend from "$lib/components/Trend.svelte";
	import { defineContent } from "$lib/i18n/locale.svelte";
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
		},
		fr: {
			title: "Potentiel SEO",
			description:
				"Trafic SEO potentiel sur les positions pas encore exploitées.",
			trafficPotential: "Potentiel de trafic",
			targetedKeywordsLabel: "Nombre de mots clés ciblés",
			positionnedKeywordsTitle: "Mots-clés positionnés",
			top3KeywordsTitle: "Mots-clés en top 3",
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
					<span class="text-xl font-bold">{Math.round(client.volume)}</span>
					<Trend trend={client.trend} />
				</div>
			</div>

			<!-- Progress bar -->
			<div class="w-full bg-gray-100 rounded-full h-2">
				<div
					class="bg-primary h-2 rounded-full"
					style:width="{(client.volume / totalVolume) * 100}%"
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
				<span class="text-xl">
					{client.positionnedKeywordCount}
				</span>
			</div>
			<div class="center justify-between">
				<span class="">{$content.top3KeywordsTitle}</span>
				<span class="text-xl">
					{client.topThreeKeywordCount}
				</span>
			</div>
		</div>
	</main>
</div>

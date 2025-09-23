<script lang="ts">
	import { defineContent, locale } from "$lib/i18n/locale.svelte";
	import type {
		AggregatedKeywordAnalysis,
		AggregatedKeywordAnalysisData,
	} from "$lib/server/clickhouse/services/keywords";
	import {
		Axis,
		Highlight,
		Layer,
		Points,
		ScatterChart,
		Tooltip,
	} from "layerchart";
	import * as Chart from "$lib/components/ui/chart/index.js";
	import type { SvelteSet } from "svelte/reactivity";
	import { formatPercent } from "$lib/numbers/formatPercent";

	const content = defineContent({
		en: {
			title: "Competitive Mapping",
			description:
				"Comparative analysis of domains by share of voice and keyword volume.",
		},
		fr: {
			title: "Cartographie de la concurrence",
			description:
				"Analyse comparative des domaines par part de voix et volume de mots-clés.",
		},
	});

	type ChartData = {
		key: string;
		data: Array<AggregatedKeywordAnalysisData & { shareOfVoice: number }>;
	};

	const chartColors: Array<string> = [
		"var(--color-primary)",
		"var(--color-info-magenta)",
		"var(--color-error)",
	];

	let {
		analysisResultsWithTrend,
		visibleDomains,
		client,
	}: {
		analysisResultsWithTrend: AggregatedKeywordAnalysis;
		visibleDomains: SvelteSet<string>;
		client: AggregatedKeywordAnalysisData;
	} = $props();

	const { data, totalVolume } = $derived(analysisResultsWithTrend);

	const { chartConfig, chartData } = $derived(
		getChartData({
			data,
		}),
	);

	function getChartData({
		data,
	}: {
		data: Array<AggregatedKeywordAnalysisData>;
	}): {
		chartConfig: Chart.ChartConfig;
		chartData: Array<ChartData>;
	} {
		let index = 0;

		const chartData: Array<ChartData> = [
			{
				key: client.domain,
				data: [
					{
						...client,
						shareOfVoice: (client.volume / totalVolume) * 100,
					},
				],
			},
		];
		const chartConfig: Chart.ChartConfig = {};

		for (const item of data.slice(0, 10)) {
			chartData.push({
				key: item.domain,
				data: item
					? [
							{
								...item,
								shareOfVoice: (item.volume / totalVolume) * 100,
							},
						]
					: [],
			});
			chartConfig[item.domain] = {
				label: item.domain,
			};
			index++;
		}

		return { chartConfig, chartData };
	}
</script>

<div class="card col justify-stretch">
	<header class="shrink-0">
		<div class="title">
			{$content.title}
		</div>
		<div class="description">
			{$content.description}
		</div>
	</header>

	<main class="col justify-stretch w-full grow">
		<Chart.Container config={chartConfig} class="h-full">
			<ScatterChart
				x="topTenKeywordCount"
				y="shareOfVoice"
				r="topThreeKeywordCount"
				xPadding={[20, 20]}
				yPadding={[20, 20]}
				series={chartData}
				renderContext="svg"
				grid={{
					x: false,
				}}
			></ScatterChart>
		</Chart.Container>
	</main>
</div>

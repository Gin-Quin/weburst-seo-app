<script lang="ts">
	import { getShareOfVoiceHistory } from "$lib/charts/getShareOfVoiceHistory";
	import Loader from "$lib/components/Loader.svelte";
	import * as Chart from "$lib/components/ui/chart/index.js";
	import { chartColors } from "$lib/charts/chartColors";
	import {
		countShareOfVoiceAnalyses,
		getShareOfVoiceSnapshot,
	} from "$lib/charts/getShareOfVoiceSnapshot";
	import { getUniqueFormattedTicks } from "$lib/charts/getUniqueFormattedTicks";
	import { defineContent, locale } from "$lib/i18n/locale.svelte";
	import { formatPercent } from "$lib/numbers/formatPercent";
	import type { ClickhouseTable } from "$lib/server/clickhouse/migrations";
	import { context } from "$lib/stores/context.svelte";
	import { scaleUtc } from "d3-scale";
	import { curveLinear } from "d3-shape";
	import { LineChart, type SeriesData } from "layerchart";
	import { untrack } from "svelte";
	import type { SvelteSet } from "svelte/reactivity";
	import { getAllAggregatedAnalysisResults } from "../../../../api/keywords/index.remote";
	import ShareOfVoiceSnapshotBarChart from "./ShareOfVoiceSnapshotBarChart.svelte";

	type ChartData = Record<string, Date | number>;

	let {
		visibleDomains,
		client,
		clusters = [],
	}: {
		visibleDomains: SvelteSet<string>;
		client: ClickhouseTable.AggregatedKeywordAnalysisData;
		clusters?: Array<{ name: string }>;
	} = $props();

	const content = defineContent({ en: { clusters: "Filter clusters", all: "All clusters", empty: "No analysis available." }, fr: { clusters: "Filtrer les clusters", all: "Tous les clusters", empty: "Aucune analyse disponible." } });
	let selectedClusters = $state<string[]>([]);
	const query = $derived(getAllAggregatedAnalysisResults({
		projectId: context.project!.id,
		...(selectedClusters.length ? { clusterNames: [...selectedClusters].sort() } : {}),
	}));
	$effect(() => {
		client.createdAt;
		const currentQuery = query;
		untrack(() => { void currentQuery.refresh(); });
	});

	function formatDate(date: Date): string {
		return date.toLocaleDateString($locale, {
			month: "short",
			day: "numeric",
		});
	}

	function getChartData({
		data,
		visibleDomains,
	}: {
		data: Awaited<ReturnType<typeof getAllAggregatedAnalysisResults>>;
		visibleDomains: Iterable<string>;
	}): {
		chartData: Array<ChartData>;
		chartConfig: Chart.ChartConfig;
		chartSeries: Array<SeriesData<ChartData, any>>;
	} {
		let index = 0;

		const chartData = getShareOfVoiceHistory(data, visibleDomains);
		const chartConfig: Chart.ChartConfig = {};
		const chartSeries: Array<SeriesData<ChartData, any>> = [];

		for (const domain of visibleDomains) {
			chartConfig[domain] = {
				color: chartColors[index % chartColors.length]!,
				label: domain,
			};
			chartSeries.push({
				key: domain,
				label: domain,
				color: chartColors[index % chartColors.length]!,
			});
			index++;
		}


		return { chartData, chartConfig, chartSeries };
	}
</script>

{#if clusters.length}
	<details class="dropdown mb-2">
		<summary class="btn control-size-1">{$content.clusters} · {selectedClusters.length || $content.all}</summary>
		<div class="dropdown-content bg-base-100 border border-border rounded-lg p-3 w-72 max-h-64 overflow-auto z-20 shadow-lg">
			<button class="btn control-size-1 mb-2" onclick={() => selectedClusters = []}>{$content.all}</button>
			{#each clusters as cluster (cluster.name)}
				<label class="flex items-center gap-2 py-1"><input class="checkbox checkbox-sm" type="checkbox" value={cluster.name} bind:group={selectedClusters} />{cluster.name}</label>
			{/each}
		</div>
	</details>
{/if}
<div class="Graph w-full min-h-0 grow">
	{#await query}
		<Loader />
	{:then data}
		{@const { chartData, chartConfig, chartSeries } = getChartData({
			data,
			visibleDomains: new Set([client.domain, ...visibleDomains]),
		})}
		{#if !data.length}
			<p class="text-light">{$content.empty}</p>
		{:else if countShareOfVoiceAnalyses(data) === 1}
			<ShareOfVoiceSnapshotBarChart
				data={getShareOfVoiceSnapshot({
					data,
					selectedDomains: [client.domain, ...visibleDomains],
				})}
				clientDomain={client.domain}
			/>
		{:else}
			<Chart.Container config={chartConfig} class="h-full">
				<LineChart
					data={chartData}
					x="date"
					xScale={scaleUtc()}
					yPadding={[0, 0]}
					seriesLayout="overlap"
					yDomain={[0, 100]}
					series={chartSeries}
					points={{ r: 3 }}
					props={{
						spline: { curve: curveLinear, class: "stroke-2" },
						xAxis: {
							ticks: (scale) => getUniqueFormattedTicks(scale, formatDate),
							format: formatDate,
						},
						yAxis: { format: (percent) => formatPercent(percent / 100) },
					}}
				>
					{#snippet tooltip()}
						<Chart.Tooltip
							indicator="dot"
							labelFormatter={formatDate}
							valueFormatter={(v: number) => formatPercent(v / 100)}
						/>
					{/snippet}

				</LineChart>
			</Chart.Container>
		{/if}
	{:catch error}
		<p class="text-error">{String(error)}</p>
	{/await}
</div>

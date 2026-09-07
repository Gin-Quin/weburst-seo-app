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
	import { locale } from "$lib/i18n/locale.svelte";
	import { formatPercent } from "$lib/numbers/formatPercent";
	import type { ClickhouseTable } from "$lib/server/clickhouse/migrations";
	import { context } from "$lib/stores/context.svelte";
	import { scaleUtc } from "d3-scale";
	import { curveLinear } from "d3-shape";
	import {
		Area,
		AreaChart,
		ChartClipPath,
		LinearGradient,
		type SeriesData,
	} from "layerchart";
	import { cubicInOut } from "svelte/easing";
	import type { SvelteSet } from "svelte/reactivity";
	import { getAllAggregatedAnalysisResults } from "../../../../api/keywords/index.remote";
	import ShareOfVoiceSnapshotBarChart from "./ShareOfVoiceSnapshotBarChart.svelte";

	type ChartData = Record<string, Date | number>;

	let {
		visibleDomains,
		client,
	}: {
		visibleDomains: SvelteSet<string>;
		client: ClickhouseTable.AggregatedKeywordAnalysisData;
	} = $props();

	const query = getAllAggregatedAnalysisResults({
		projectId: context.project!.id,
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

<div class="Graph w-full min-h-0 grow">
	{#await query}
		<Loader />
	{:then data}
		{@const { chartData, chartConfig, chartSeries } = getChartData({
			data,
			visibleDomains: new Set([client.domain, ...visibleDomains]),
		})}
		{#if countShareOfVoiceAnalyses(data) === 1}
			<ShareOfVoiceSnapshotBarChart
				data={getShareOfVoiceSnapshot({
					data,
					selectedDomains: [client.domain, ...visibleDomains],
				})}
				clientDomain={client.domain}
			/>
		{:else}
			<Chart.Container config={chartConfig} class="h-full">
				<AreaChart
					data={chartData}
					x="date"
					xScale={scaleUtc()}
					yPadding={[0, 0]}
					seriesLayout="stack"
					series={chartSeries}
					points={{ r: 3 }}
					props={{
						area: {
							curve: curveLinear,
							"fill-opacity": 0.4,
							line: { class: "stroke-1" },
							motion: "tween",
						},
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

					{#snippet marks({ series, getAreaProps })}
						<ChartClipPath
							initialWidth={0}
							motion={{
								width: { type: "tween", duration: 1000, easing: cubicInOut },
							}}
						>
							{#each series as s, i (s.key)}
								<LinearGradient
									stops={[
										s.color ?? "",
										"color-mix(in lch, " + s.color + " 10%, transparent)",
									]}
									vertical
								>
									{#snippet children({ gradient })}
										<Area {...getAreaProps(s, i)} fill={gradient} />
									{/snippet}
								</LinearGradient>
							{/each}
						</ChartClipPath>
					{/snippet}
				</AreaChart>
			</Chart.Container>
		{/if}
	{/await}
</div>

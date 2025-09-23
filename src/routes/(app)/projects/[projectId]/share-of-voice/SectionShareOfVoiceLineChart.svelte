<script lang="ts">
	import Loader from "$lib/components/Loader.svelte";
	import Trend from "$lib/components/Trend.svelte";
	import * as Chart from "$lib/components/ui/chart/index.js";
	import { formatPercent } from "$lib/numbers/formatPercent";
	import type {
		AggregatedKeywordAnalysisData,
		DatedAggregatedKeywordAnalysis,
	} from "$lib/server/clickhouse/services/keywords";
	import { context } from "$lib/stores/context.svelte";
	import {
		Area,
		AreaChart,
		Axis,
		ChartClipPath,
		LinearGradient,
		type SeriesData,
	} from "layerchart";
	import type { SvelteSet } from "svelte/reactivity";
	import { getAllAggregatedAnalysisResults } from "../../../../api/keywords/index.remote";
	import { locale } from "$lib/i18n/locale.svelte";
	import { scaleUtc } from "d3-scale";
	import { curveNatural } from "d3-shape";
	import { cubicInOut } from "svelte/easing";

	type ChartData = Record<string, Date | number>;

	const chartColors: Array<string> = [
		"var(--color-primary)",
		"var(--color-info-magenta)",
		"var(--color-error)",
	];

	let {
		visibleDomains,
		totalVolume,
		client,
	}: {
		visibleDomains: SvelteSet<string>;
		totalVolume: number;
		client: AggregatedKeywordAnalysisData;
	} = $props();

	const query = getAllAggregatedAnalysisResults({
		projectId: context.project!.id,
	});

	function getChartData({
		data,
		visibleDomains,
	}: {
		data: Array<DatedAggregatedKeywordAnalysis>;
		visibleDomains: SvelteSet<string>;
	}): {
		chartData: Array<ChartData>;
		chartConfig: Chart.ChartConfig;
		chartSeries: Array<SeriesData<ChartData, any>>;
	} {
		let index = 0;

		const chartData = Array<ChartData>();
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

		for (const analysis of data) {
			const item: ChartData = {
				date: new Date(analysis.createdAt),
			};

			for (const domain of visibleDomains) {
				const domainData = analysis.data.find((item) => item.domain === domain);
				const volume = domainData ? Math.round(domainData.volume) : 0;
				item[domain] = (volume / totalVolume) * 100;
			}
			chartData.push(item);
		}

		return { chartData, chartConfig, chartSeries };
	}
</script>

<div class="row justify-between items-center">
	<div class="row items-center gap-2">
		<div class="text-4xl font-bold">
			{formatPercent(client.volume / totalVolume, {
				maximumFractionDigits: 0,
			})}
		</div>
		<Trend trend={client.trend} />
	</div>
</div>

<div class="Graph w-full grow">
	{#await query}
		<Loader />
	{:then data}
		{@const { chartData, chartConfig, chartSeries } = getChartData({
			data,
			visibleDomains,
		})}
		<Chart.Container config={chartConfig} class="h-full">
			<AreaChart
				data={chartData}
				x="date"
				xScale={scaleUtc()}
				yPadding={[0, 0]}
				seriesLayout="stack"
				series={chartSeries}
				props={{
					area: {
						curve: curveNatural,
						"fill-opacity": 0.4,
						line: { class: "stroke-1" },
						motion: "tween",
					},
					xAxis: {
						format: (v: Date) =>
							v.toLocaleDateString($locale, {
								month: "short",
								day: "numeric",
							}),
					},
					yAxis: { format: (percent) => formatPercent(percent / 100) },
				}}
			>
				{#snippet tooltip()}
					<Chart.Tooltip
						indicator="dot"
						labelFormatter={(v: Date) => {
							return v.toLocaleDateString($locale, {
								month: "short",
								day: "numeric",
							});
						}}
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
	{/await}
</div>

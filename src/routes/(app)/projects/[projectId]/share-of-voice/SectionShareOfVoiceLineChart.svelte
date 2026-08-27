<script lang="ts">
	import Loader from "$lib/components/Loader.svelte";
	import Trend from "$lib/components/Trend.svelte";
	import * as Chart from "$lib/components/ui/chart/index.js";
	import { chartColors } from "$lib/charts/chartColors";
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

	type ChartData = Record<string, Date | number>;

	let {
		visibleDomains,
		totalTraffic,
		client,
	}: {
		visibleDomains: SvelteSet<string>;
		totalTraffic: number;
		client: ClickhouseTable.AggregatedKeywordAnalysisData;
	} = $props();

	const query = getAllAggregatedAnalysisResults({
		projectId: context.project!.id,
	});

	function getChartData({
		data,
		visibleDomains,
	}: {
		data: Awaited<ReturnType<typeof getAllAggregatedAnalysisResults>>;
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

		const rowsByDate = new Map<string, ChartData>();
		for (const analysis of data) {
			if (!visibleDomains.has(analysis.domain)) {
				continue;
			}
			const key = analysis.createdAt;
			let item = rowsByDate.get(key);
			if (!item) {
				item = { date: new Date(analysis.createdAt) };
				rowsByDate.set(key, item);
			}
			item[analysis.domain] = (analysis.volume / (analysis.totalVolume || 1)) * 100;
		}

		for (const item of rowsByDate.values()) {
			for (const domain of visibleDomains) {
				if (item[domain] === undefined) {
					item[domain] = 0;
				}
			}
			chartData.push(item);
		}

		chartData.sort((a, b) => {
			const aDate = a.date instanceof Date ? a.date.getTime() : 0;
			const bDate = b.date instanceof Date ? b.date.getTime() : 0;
			return aDate - bDate;
		});

		return { chartData, chartConfig, chartSeries };
	}
</script>

<div class="row justify-between items-center">
	<div class="row items-center gap-2">
		<div class="text-4xl font-bold">
			{formatPercent(client.volume / (totalTraffic || 1), {
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
				points={{ r: 3 }}
				props={{
					area: {
						curve: curveLinear,
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

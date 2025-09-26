<script lang="ts">
	import * as Chart from "$lib/components/ui/chart/index.js";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { formatPercent } from "$lib/numbers/formatPercent";
	import type {
		AggregatedKeywordAnalysis,
		AggregatedKeywordAnalysisData,
	} from "$lib/server/clickhouse/services/keywords";
	import { pointRadial } from "d3-shape";
	import { Axis, Circle, Points, ScatterChart, Svg, Tooltip } from "layerchart";
	import type { SvelteSet } from "svelte/reactivity";

	const content = defineContent({
		en: {
			title: "Competitive Mapping",
			description:
				"Comparative analysis of domains by share of voice and keyword volume.",
			shareOfVoice: "Share of Voice",
			positionnedKeywordCount: "Positionned Keywords",
			top3Keywords: "Top 3 Keywords",
		},
		fr: {
			title: "Cartographie de la concurrence",
			description:
				"Analyse comparative des domaines par part de voix et volume de mots-clés.",
			shareOfVoice: "Part de voix",
			positionnedKeywordCount: "Mots-clés positionnés",
			top3Keywords: "Mots-clés top 3",
		},
	});

	type ChartData = {
		key: string;
		data: Array<{
			domain: string;
			x: number;
			y: number;
			r: number;
			source: AggregatedKeywordAnalysisData;
		}>;
	};

	const chartColors: Array<string> = [
		// "var(--color-info-magenta)",
		"var(--color-info-purple)",
		// "var(--color-error)",
		// "var(--color-success)",
		// "var(--color-warning)",
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

		const chartData: Array<ChartData> = [];
		const chartConfig: Chart.ChartConfig = {};

		for (const item of data.slice(0, 10)) {
			chartData.push({
				key: item.domain,
				data: item
					? [
							{
								domain: item.domain,
								x: item.positionnedKeywordCount,
								y: (item.volume / totalVolume) * 100,
								r: 4 + Math.sqrt(5 * item.topThreeKeywordCount),
								source: item,
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

	<main class="col justify-stretch w-full grow p-0! relative text-[0.6875rem]">
		<div class="absolute bottom-1 w-full grow text-center font-bold">
			{$content.positionnedKeywordCount}
		</div>
		<div class="absolute left-1 h-full center font-bold">
			<div class="Label Y">
				{$content.shareOfVoice}
			</div>
		</div>
		<div class="col justify-stretch w-full grow overflow-hidden p-5">
			<Chart.Container config={chartConfig} class="h-full pl-2">
				<ScatterChart
					x="x"
					y="y"
					r="r"
					xPadding={[20, 20]}
					yPadding={[20, 20]}
					series={chartData}
					renderContext="svg"
					grid={{ x: false }}
					props={{
						xAxis: {
							label: "HELLO",
						},
						yAxis: {
							format: (percent) => formatPercent(percent / 100),
						},
					}}
				>
					{#snippet marks({ context: ctx })}
						{#each chartData as series, index (series.key)}
							<Points
								data={series.data}
								fill="red"
								stroke="blue"
								width={10}
								height={10}
								strokeWidth={2}
							>
								{#snippet children({ points })}
									{#each points as point}
										{@const radialPoint = pointRadial(point.x, point.y)}
										<Circle
											cx={ctx.radial ? radialPoint[0] : point.x}
											cy={ctx.radial ? radialPoint[1] : point.y}
											r={point.data.r}
											fill={point.data.domain == client.domain
												? "var(--color-primary)"
												: chartColors[index % chartColors.length]}
											fillOpacity={point.data.domain == client.domain ? 1 : 0.1}
											strokeWidth={1}
											stroke={point.data.domain == client.domain
												? "var(--color-primary)"
												: chartColors[index % chartColors.length]}
										/>
										<!-- <text
										fill="black"
										text-anchor="middle"
										x={ctx.radial ? radialPoint[0] : point.x}
										y={ctx.radial ? radialPoint[1] : point.y}
									>
										{series.key}
									</text> -->
									{/each}
								{/snippet}
							</Points>
						{/each}
					{/snippet}

					{#snippet tooltip({ context: ctx })}
						<Tooltip.Root context={ctx}>
							{#snippet children({ data })}
								<div
									class="border-border/50 bg-background grid min-w-[9rem] items-start gap-1.5 rounded-[0.5rem] border px-2.5 py-1.5 text-xs shadow-xl"
								>
									<div class="col items-stretch gap-1 font-bold">
										<div
											class={data.domain == client.domain
												? "text-primary"
												: "text-light"}
										>
											{data.domain}
										</div>

										<div class="col items-stretch gap-0">
											<div class="row justify-between gap-4">
												<span class="font-normal">
													{$content.shareOfVoice}
												</span>
												<span>
													{formatPercent(data.y / 100)}
												</span>
											</div>

											<div class="row justify-between gap-4">
												<span class="font-normal">
													{$content.positionnedKeywordCount}
												</span>
												<span>
													{data.source.positionnedKeywordCount}
												</span>
											</div>

											<div class="row justify-between gap-4">
												<span class="font-normal">
													{$content.top3Keywords}
												</span>
												<span>
													{data.source.topThreeKeywordCount}
												</span>
											</div>
										</div>
									</div>
								</div>
							{/snippet}
						</Tooltip.Root>
					{/snippet}
				</ScatterChart>
			</Chart.Container>
		</div>
	</main>
</div>

<style>
	.Label {
		&.Y {
			writing-mode: sideways-lr;
		}
	}
</style>

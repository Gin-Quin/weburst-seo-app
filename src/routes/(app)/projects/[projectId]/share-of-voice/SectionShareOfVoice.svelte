<script lang="ts">
	import * as Chart from "$lib/components/ui/chart/index.js";
	import { PieChart } from "layerchart";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import IconArrowUpRegular from "phosphor-icons-svelte/IconArrowUpRegular.svelte";
	import IconChartLineRegular from "phosphor-icons-svelte/IconChartLineRegular.svelte";
	import IconChartPieSliceRegular from "phosphor-icons-svelte/IconChartPieSliceRegular.svelte";
	import { scaleUtc } from "d3-scale";
	import { curveNatural } from "d3-shape";
	import { Area, AreaChart, LinearGradient } from "layerchart";
	import type { AggregatedKeywordAnalysis } from "$lib/server/clickhouse/services/keywords";
	import type { SvelteSet } from "svelte/reactivity";
	import { context } from "$lib/stores/context.svelte";
	import { formatPercent } from "$lib/numbers/formatPercent";
	import IconArrowDownRegular from "phosphor-icons-svelte/IconArrowDownRegular.svelte";

	type PieChartData = {
		domain: string;
		volume: number;
		color: string;
	};

	type LineChartData = {
		date: Date;
		value: number;
		color: string;
	};

	const chartColors: Array<string> = [
		"var(--color-primary)",
		"var(--color-info-magenta)",
		"var(--color-error)",
	];

	const content = defineContent({
		en: {
			title: "Share of Voice",
			description:
				"Evolution of your visibility on the targeted keyword field.",
			others: "Others",
		},
		fr: {
			title: "Part de voix",
			description:
				"Évolution de votre visibilité sur le champ de mots-clés ciblés.",
			others: "Autres",
		},
	});

	let {
		analysisResultsWithTrend,
		visibleDomains,
	}: {
		analysisResultsWithTrend: AggregatedKeywordAnalysis | null;
		visibleDomains: SvelteSet<string>;
	} = $props();

	let chartType = $state<"line" | "pie">(
		context.project!.type == "audit" ? "pie" : "line",
	);

	const chartData = [
		{ date: new Date("2024-01-01"), desktop: 186 },
		{ date: new Date("2024-02-01"), desktop: 305 },
		{ date: new Date("2024-03-01"), desktop: 237 },
		{ date: new Date("2024-04-01"), desktop: 73 },
		{ date: new Date("2024-05-01"), desktop: 209 },
		{ date: new Date("2024-06-01"), desktop: 214 },
	];

	const chartConfig = {
		desktop: { label: "Desktop", color: "var(--chart-1)" },
	} satisfies Chart.ChartConfig;

	function getPieChartData({
		data,
		totalVolume,
		visibleDomains,
	}: Pick<AggregatedKeywordAnalysis, "data" | "totalVolume"> & {
		visibleDomains: SvelteSet<string>;
	}): { pieChartData: Array<PieChartData>; pieChartConfig: Chart.ChartConfig } {
		let visibleDomainsVolume = 0;
		let index = 0;

		const pieChartData = Array<PieChartData>();
		const pieChartConfig: Chart.ChartConfig = {};

		for (const domain of visibleDomains) {
			const domainData = data.find((item) => item.domain === domain);
			const volume = domainData ? Math.round(domainData.volume) : 0;
			visibleDomainsVolume += volume;

			pieChartData.push({
				domain,
				volume,
				color: chartColors[index % chartColors.length],
			});
			pieChartConfig[domain] = {
				label: domain,
				color: chartColors[index % chartColors.length],
			};

			index += 1;
		}

		pieChartData.push({
			domain: "others",
			volume: totalVolume - visibleDomainsVolume,
			color: "var(--color-gray-2)",
		});
		pieChartConfig["others"] = {
			label: $content.others,
			color: "var(--color-gray-2)",
		};

		return { pieChartData, pieChartConfig };
	}

	function getChartLineData() {}
</script>

<div class="card col justify-stretch">
	<header class="flex-row! justify-between items-center gap-4 shrink-0">
		<div class="col gap-1">
			<div class="title">
				{$content.title}
			</div>
			<div class="description">
				{$content.description}
			</div>
		</div>

		<div class="join gap-1">
			<button
				class="Toggle"
				class:active={chartType === "pie"}
				onclick={() => (chartType = "pie")}
			>
				<IconChartPieSliceRegular class="icon" />
			</button>
			<button
				class="Toggle"
				class:active={chartType === "line"}
				onclick={() => (chartType = "line")}
			>
				<IconChartLineRegular class="icon" />
			</button>
		</div>
	</header>

	<main class="col justify-stretch w-full grow">
		{#if analysisResultsWithTrend == null}
			NO RESULTS YET
		{:else}
			{@const { data, totalVolume } = analysisResultsWithTrend}
			{@const client = data.find(
				(item) => item.domain === context.project!.domain,
			) ?? {
				domain: context.project!.domain,
				volume: 0,
				trend: 0,
			}}

			{#if chartType == "line"}
				<div class="row justify-between items-center">
					<div class="row items-center gap-2">
						<div class="text-4xl font-bold">
							{formatPercent(client.volume / totalVolume, {
								maximumFractionDigits: 0,
							})}
						</div>
						{#if client.trend && client.trend >= 0.1}
							<div class="badge badge-success">
								<IconArrowUpRegular class="text-small" />
								{formatPercent(client.trend)}
							</div>
						{:else if client.trend && client.trend <= -0.1}
							<div class="badge badge-warning">
								<IconArrowDownRegular class="text-small" />
								{formatPercent(Math.abs(client.trend))}
							</div>
						{/if}
					</div>
				</div>

				<div class="Graph w-full grow">
					<Chart.Container config={chartConfig} class="h-full">
						<AreaChart
							data={chartData}
							x="date"
							xScale={scaleUtc()}
							yPadding={[0, 25]}
							series={[
								{
									key: "mobile",
									label: "Mobile",
									color: "var(--color-mobile)",
								},
								{
									key: "desktop",
									label: "Desktop",
									color: "var(--color-desktop)",
								},
							]}
							seriesLayout="stack"
							props={{
								area: {
									curve: curveNatural,
									"fill-opacity": 0.4,
									line: { class: "stroke-1" },
									motion: "tween",
								},
								xAxis: {
									format: (v: Date) =>
										v.toLocaleDateString("en-US", { month: "short" }),
								},
								yAxis: { format: () => "" },
							}}
						>
							{#snippet tooltip()}
								<Chart.Tooltip
									indicator="dot"
									labelFormatter={(v: Date) => {
										return v.toLocaleDateString("en-US", {
											month: "long",
										});
									}}
								/>
							{/snippet}
							{#snippet marks({ series, getAreaProps })}
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
							{/snippet}
						</AreaChart>
					</Chart.Container>
				</div>
			{:else if chartType == "pie"}
				{@const { pieChartData, pieChartConfig } = getPieChartData({
					data,
					totalVolume,
					visibleDomains,
				})}

				<div class="Graph w-full grow">
					<Chart.Container
						config={pieChartConfig}
						class="mx-auto aspect-square h-full center"
					>
						<div class="absolute col center">
							{#if client.trend && client.trend >= 0.1}
								<div class="badge badge-success translate-y-[-0.5rem]">
									<IconArrowUpRegular class="text-small" />
									{formatPercent(client.trend)}
								</div>
							{:else if client.trend && client.trend <= -0.1}
								<div class="badge badge-warning translate-y-[-0.5rem]">
									<IconArrowDownRegular class="text-small" />
									{formatPercent(Math.abs(client.trend))}
								</div>
							{/if}
							<div class="text-5xl font-bold">
								{formatPercent(client.volume / totalVolume, {
									maximumFractionDigits: 0,
								})}
							</div>
						</div>

						<PieChart
							data={pieChartData}
							key="domain"
							value="volume"
							c="color"
							innerRadius={0.75}
							padding={28}
							props={{ pie: { motion: "tween" } }}
						>
							{#snippet tooltip()}
								<Chart.Tooltip hideLabel />
							{/snippet}
						</PieChart>
					</Chart.Container>
				</div>
			{/if}
		{/if}
	</main>
</div>

<style>
	.Toggle {
		padding: 0.125rem;
		color: #ccc;
		border-radius: 0.25rem;
		border: 1px solid transparent;

		&:hover {
			background-color: var(--color-base-300);
			cursor: pointer;
		}

		&.active {
			color: var(--color-primary);
			border-color: var(--color-primary-content);
		}
	}
</style>

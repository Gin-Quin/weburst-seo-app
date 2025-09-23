<script lang="ts">
	import Trend from "$lib/components/Trend.svelte";
	import * as Chart from "$lib/components/ui/chart/index.js";
	import Table from "$lib/components/ui/table/table.svelte";
	import { defineContent, locale } from "$lib/i18n/locale.svelte";
	import { formatPercent } from "$lib/numbers/formatPercent";
	import type {
		AggregatedKeywordAnalysis,
		AggregatedKeywordAnalysisData,
	} from "$lib/server/clickhouse/services/keywords";
	import { PieChart } from "layerchart";
	import type { SvelteSet } from "svelte/reactivity";

	const content = defineContent({
		en: {
			others: "Others",
		},
		fr: {
			others: "Autres",
		},
	});

	type PieChartData = {
		domain: string;
		volume: number;
		color: string;
	};

	const chartColors: Array<string> = [
		"var(--color-info-magenta)",
		"var(--color-error)",
		"var(--color-warning)",
		"var(--color-accent)",
	];

	let {
		data,
		visibleDomains,
		totalVolume,
		client,
	}: {
		data: Array<AggregatedKeywordAnalysisData>;
		visibleDomains: SvelteSet<string>;
		totalVolume: number;
		client: AggregatedKeywordAnalysisData;
	} = $props();

	const { pieChartData, pieChartConfig } = $derived(
		getPieChartData({
			data,
			totalVolume,
			visibleDomains,
		}),
	);

	function getPieChartData({
		data,
		totalVolume,
		visibleDomains,
	}: Pick<AggregatedKeywordAnalysis, "data" | "totalVolume"> & {
		visibleDomains: SvelteSet<string>;
	}): { pieChartData: Array<PieChartData>; pieChartConfig: Chart.ChartConfig } {
		let visibleDomainsVolumePercent = 0;
		let index = 0;

		const pieChartData = Array<PieChartData>();
		const pieChartConfig: Chart.ChartConfig = {};

		for (const domain of visibleDomains) {
			const domainData = data.find((item) => item.domain === domain);
			const volumePercent = domainData
				? (domainData.volume / totalVolume) * 100
				: 0;
			visibleDomainsVolumePercent += volumePercent;

			const color =
				domain == client.domain
					? "var(--color-primary)"
					: chartColors[index % chartColors.length]!;
			pieChartData.push({
				domain,
				volume: volumePercent,
				color,
			});
			pieChartConfig[domain] = {
				label: domain,
				color,
			};

			index += 1;
		}

		pieChartData.push({
			domain: "others",
			volume: 100 - visibleDomainsVolumePercent,
			color: "var(--color-gray-2)",
		});
		pieChartConfig["others"] = {
			label: $content.others,
			color: "var(--color-gray-2)",
		};

		return { pieChartData, pieChartConfig };
	}
</script>

<div class="Graph w-full grow">
	<Chart.Container
		config={pieChartConfig}
		class="mx-auto aspect-square h-full center"
	>
		<div class="absolute col center">
			<Trend trend={client.trend} />
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
			props={{
				pie: { motion: "tween" },
			}}
		>
			{#snippet tooltip()}
				<Chart.Tooltip
					hideLabel
					valueFormatter={(v: number) => formatPercent(v / 100)}
				/>
			{/snippet}
		</PieChart>
	</Chart.Container>
</div>

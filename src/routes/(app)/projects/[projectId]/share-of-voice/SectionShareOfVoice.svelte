<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { ClickhouseTable } from "$lib/server/clickhouse/migrations";
	import type { AggregatedKeywordAnalysis } from "$lib/server/clickhouse/services/keywords";
	import IconChartBarRegular from "phosphor-icons-svelte/IconChartBarRegular.svelte";
	import IconChartLineRegular from "phosphor-icons-svelte/IconChartLineRegular.svelte";
	import IconChartPieSliceRegular from "phosphor-icons-svelte/IconChartPieSliceRegular.svelte";
	import type { SvelteSet } from "svelte/reactivity";
	import SectionShareOfVoiceBarChart from "./SectionShareOfVoiceBarChart.svelte";
	import SectionShareOfVoiceLineChart from "./SectionShareOfVoiceLineChart.svelte";
	import SectionShareOfVoicePieChart from "./SectionShareOfVoicePieChart.svelte";

	const content = defineContent({
		en: {
			title: "Share of Voice",
			description:
				"Evolution of your visibility on the targeted keyword field.",
			others: "Others",
			pieChart: "Pie chart",
			lineChart: "Evolution chart",
			barChart: "Cluster bar chart",
			allClusters: "All clusters",
			filterCluster: "Filter by cluster",
		},
		fr: {
			title: "Part de voix",
			description:
				"Évolution de votre visibilité sur le champ de mots-clés ciblés.",
			others: "Autres",
			pieChart: "Graphique circulaire",
			lineChart: "Graphique d'évolution",
			barChart: "Graphique en barres par cluster",
			allClusters: "Tous les clusters",
			filterCluster: "Filtrer par cluster",
		},
	});

	let {
		analysisResultsWithTrend,
		visibleDomains,
		client,
	}: {
		analysisResultsWithTrend: AggregatedKeywordAnalysis;
		visibleDomains: SvelteSet<string>;
		client: ClickhouseTable.AggregatedKeywordAnalysisData;
	} = $props();

	const { data, totalTraffic, clusters } = $derived(analysisResultsWithTrend);

	let selectedClusterName = $state("");
	const selectedCluster = $derived(
		clusters.length >= 2
			? clusters.find((cluster) => cluster.name === selectedClusterName)
			: undefined,
	);
	const filteredClient = $derived(
		selectedCluster
			? {
					...client,
					volume:
						selectedCluster.domains.find(
							(item) => item.domain === client.domain,
						)?.volume ?? 0,
				}
			: client,
	);

	$effect(() => {
		if (selectedClusterName && !selectedCluster) selectedClusterName = "";
	});

	let chartType = $state<"line" | "pie" | "bar">("pie");

	$effect(() => {
		if (clusters.length < 2 && chartType === "bar") chartType = "pie";
	});
</script>

<div class="card col justify-stretch">
	<header class="flex-row! justify-between items-center gap-4 shrink-0">
		<div class="col gap-1">
			<div class="flex items-center gap-3 flex-wrap">
				<div class="title">{$content.title}</div>
				{#if chartType !== "bar" && clusters.length >= 2}
					<select
						class="select control-size-1 w-auto max-w-full"
						style="--control-size-1-height: 28px; --control-size-1-padding-inline: 8px; font-size: 0.875rem; padding-block: 0; padding-inline-end: 32px; translate: 0 1px;"
						aria-label={$content.filterCluster}
						bind:value={selectedClusterName}
					>
						<option value="">{$content.allClusters}</option>
						{#each clusters as cluster (cluster.name)}
							<option value={cluster.name}>{cluster.name}</option>
						{/each}
					</select>
				{/if}
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
				aria-label={$content.pieChart}
				title={$content.pieChart}
				aria-pressed={chartType === "pie"}
			>
				<IconChartPieSliceRegular class="icon" />
			</button>
			<button
				class="Toggle"
				class:active={chartType === "line"}
				onclick={() => (chartType = "line")}
				aria-label={$content.lineChart}
				title={$content.lineChart}
				aria-pressed={chartType === "line"}
			>
				<IconChartLineRegular class="icon" />
			</button>
			{#if clusters.length >= 2}
				<button
					class="Toggle"
					class:active={chartType === "bar"}
					onclick={() => (chartType = "bar")}
					aria-label={$content.barChart}
					title={$content.barChart}
					aria-pressed={chartType === "bar"}
				>
					<IconChartBarRegular class="icon" />
				</button>
			{/if}
		</div>
	</header>

	<main class="col justify-stretch w-full grow gap-1">
		{#if chartType == "line"}
			<SectionShareOfVoiceLineChart
				{visibleDomains}
				{client}
				selectedClusterName={selectedCluster?.name ?? ""}
			/>
		{:else if chartType == "pie"}
			<SectionShareOfVoicePieChart
				data={selectedCluster?.domains ?? data}
				totalTraffic={selectedCluster?.totalTraffic ?? totalTraffic}
				{visibleDomains}
				client={filteredClient}
				showTrend={!selectedCluster}
				trendDays={analysisResultsWithTrend.trendDays}
			/>
		{:else if chartType == "bar"}
			<SectionShareOfVoiceBarChart
				analysisResults={analysisResultsWithTrend}
				{client}
			/>
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

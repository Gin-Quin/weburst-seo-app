<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { ClickhouseTable } from "$lib/server/clickhouse/migrations";
	import type { AggregatedKeywordAnalysis } from "$lib/server/clickhouse/services/keywords";
	import IconChartLineRegular from "phosphor-icons-svelte/IconChartLineRegular.svelte";
	import IconChartPieSliceRegular from "phosphor-icons-svelte/IconChartPieSliceRegular.svelte";
	import type { SvelteSet } from "svelte/reactivity";
	import SectionShareOfVoiceLineChart from "./SectionShareOfVoiceLineChart.svelte";
	import SectionShareOfVoicePieChart from "./SectionShareOfVoicePieChart.svelte";

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
		client,
	}: {
		analysisResultsWithTrend: AggregatedKeywordAnalysis;
		visibleDomains: SvelteSet<string>;
		client: ClickhouseTable.AggregatedKeywordAnalysisData;
	} = $props();

	const { data, totalVolume } = $derived(analysisResultsWithTrend);

	let chartType = $state<"line" | "pie">("pie");
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

	<main class="col justify-stretch w-full grow gap-1">
		{#if chartType == "line"}
			<SectionShareOfVoiceLineChart {totalVolume} {visibleDomains} {client} />
		{:else if chartType == "pie"}
			<SectionShareOfVoicePieChart
				{data}
				{totalVolume}
				{visibleDomains}
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

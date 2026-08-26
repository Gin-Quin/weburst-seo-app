<script lang="ts">
	import { defineContent, locale } from "$lib/i18n/locale.svelte";
	import {
		getClusterBarChartData,
		type ClusterBarChartData,
	} from "$lib/keywords/getClusterBarChartData";
	import { formatPercent } from "$lib/numbers/formatPercent";
	import type {
		AggregatedKeywordAnalysis,
		AggregatedKeywordAnalysisData,
	} from "$lib/server/clickhouse/services/keywords";
	import type { SvelteSet } from "svelte/reactivity";

	const content = defineContent({
		en: {
			competitors: "Competitors",
			clusterShare: "Share of voice per cluster (%)",
			globalVolume: "Global volume",
			clusters: "Clusters",
			chartLabel: "Latest share of voice analysis by keyword cluster",
		},
		fr: {
			competitors: "Concurrents",
			clusterShare: "Part de voix par cluster (en %)",
			globalVolume: "Volume global",
			clusters: "Clusters",
			chartLabel: "Dernière analyse de part de voix par cluster",
		},
	});

	let {
		analysisResults,
		visibleDomains,
		client,
	}: {
		analysisResults: AggregatedKeywordAnalysis;
		visibleDomains: SvelteSet<string>;
		client: AggregatedKeywordAnalysisData;
	} = $props();

	const LEFT = 58;
	const RIGHT = 24;
	const TOP = 38;
	const BOTTOM = 252;
	const HEIGHT = 326;
	const PLOT_HEIGHT = BOTTOM - TOP;

	const chartResult = $derived(
		getClusterBarChartData({
			clusters: analysisResults.clusters,
			clientDomain: client.domain,
			selectedDomains: visibleDomains,
		}),
	);
	const comparisonLabel = $derived(
		chartResult.comparisonDomain ?? $content.competitors,
	);
	const chartWidth = $derived(
		Math.max(620, analysisResults.clusters.length * 92 + LEFT + RIGHT),
	);
	const shareMax = $derived.by(() => {
		const highestShare = Math.max(
			100,
			...chartResult.data.flatMap(({ clientShare, comparisonShare }) => [
				clientShare,
				comparisonShare,
			]),
		);
		return Math.ceil(highestShare / 25) * 25;
	});
	const shareTicks = $derived(
		Array.from({ length: 5 }, (_, index) => (shareMax / 4) * index),
	);
	function shareY(value: number): number {
		return BOTTOM - (value / shareMax) * PLOT_HEIGHT;
	}

	function formatVolume(value: number): string {
		return new Intl.NumberFormat($locale, {
			notation: "compact",
			maximumFractionDigits: 1,
		}).format(value);
	}

	function formatShareTick(value: number): string {
		return new Intl.NumberFormat($locale, {
			maximumFractionDigits: 1,
		}).format(value);
	}

	function compactLabel(label: string): string {
		return label.length > 16 ? `${label.slice(0, 15)}…` : label;
	}

	function getGeometry(item: ClusterBarChartData, index: number) {
		const plotWidth = chartWidth - LEFT - RIGHT;
		const slotWidth = Math.min(92, plotWidth / Math.max(1, chartResult.data.length));
		const firstX = LEFT + (plotWidth - slotWidth * chartResult.data.length) / 2;
		const backgroundWidth = Math.min(74, slotWidth * 0.8);
		const gap = 4;
		const barWidth = (backgroundWidth - gap) / 2;
		const backgroundX = firstX + index * slotWidth + (slotWidth - backgroundWidth) / 2;
		const clientY = shareY(item.clientShare);
		const comparisonY = shareY(item.comparisonShare);

		return {
			centerX: firstX + index * slotWidth + slotWidth / 2,
			backgroundX,
			backgroundWidth,
			backgroundY: TOP,
			barWidth,
			clientX: backgroundX,
			clientY,
			clientHeight: BOTTOM - clientY,
			comparisonX: backgroundX + barWidth + gap,
			comparisonY,
			comparisonHeight: BOTTOM - comparisonY,
		};
	}
</script>

<div class="ChartHeader">
	<div class="LegendItem" title={client.domain}>
		<span class="LegendDot ClientDot"></span>
		<span>{client.domain}</span>
	</div>
	<div class="LegendItem" title={comparisonLabel}>
		<span class="LegendDot ComparisonDot"></span>
		<span>{comparisonLabel}</span>
	</div>
</div>

<div class="Graph" tabindex="0">
	<svg
		role="img"
		aria-label={$content.chartLabel}
		viewBox={`0 0 ${chartWidth} ${HEIGHT}`}
		style={`width: ${chartWidth}px`}
	>
		{#each shareTicks as tick (tick)}
			{@const y = shareY(tick)}
			<line class="GridLine" x1={LEFT} x2={chartWidth - RIGHT} y1={y} y2={y} />
			<text class="AxisTick" x={LEFT - 10} y={y + 4} text-anchor="end">
				{formatShareTick(tick)}
			</text>
		{/each}

		<text
			class="AxisTitle"
			x="18"
			y={(TOP + BOTTOM) / 2}
			text-anchor="middle"
			transform={`rotate(-90 18 ${(TOP + BOTTOM) / 2})`}
		>
			{$content.clusterShare}
		</text>
		{#each chartResult.data as item, index (item.name)}
			{@const geometry = getGeometry(item, index)}
			<rect
				class="VolumeBar"
				x={geometry.backgroundX}
				y={geometry.backgroundY}
				width={geometry.backgroundWidth}
				height={BOTTOM - geometry.backgroundY}
				rx="9"
			>
				<title>{item.name} — {$content.globalVolume}: {formatVolume(item.totalVolume)}</title>
			</rect>
			<rect
				class="ClientBar"
				x={geometry.clientX}
				y={geometry.clientY}
				width={geometry.barWidth}
				height={geometry.clientHeight}
				rx="5"
			>
				<title>{item.name} — {client.domain}: {formatPercent(item.clientShare / 100)}</title>
			</rect>
			<rect
				class="ComparisonBar"
				x={geometry.comparisonX}
				y={geometry.comparisonY}
				width={geometry.barWidth}
				height={geometry.comparisonHeight}
				rx="5"
			>
				<title>{item.name} — {comparisonLabel}: {formatPercent(item.comparisonShare / 100)}</title>
			</rect>

			{#if geometry.clientHeight > 34}
				<text
					class="BarLabel ClientLabel"
					x={geometry.clientX + geometry.barWidth / 2}
					y={BOTTOM - 8}
					transform={`rotate(-90 ${geometry.clientX + geometry.barWidth / 2} ${BOTTOM - 8})`}
				>
					{compactLabel(client.domain)}
				</text>
			{/if}
			{#if geometry.comparisonHeight > 34}
				<text
					class="BarLabel ComparisonLabel"
					x={geometry.comparisonX + geometry.barWidth / 2}
					y={BOTTOM - 8}
					transform={`rotate(-90 ${geometry.comparisonX + geometry.barWidth / 2} ${BOTTOM - 8})`}
				>
					{compactLabel(comparisonLabel)}
				</text>
			{/if}

			<text
				class="ClusterLabel"
				x={geometry.centerX}
				y={BOTTOM + 18}
				text-anchor="end"
				transform={`rotate(-42 ${geometry.centerX} ${BOTTOM + 18})`}
			>
				{compactLabel(item.name)}
				<title>{item.name}</title>
			</text>
		{/each}

		<text class="XAxisTitle" x={chartWidth - RIGHT} y={HEIGHT - 5} text-anchor="end">
			{$content.clusters}
		</text>
	</svg>
</div>

<style>
	.ChartHeader {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 1rem;
		min-height: 1.5rem;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.LegendItem {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		max-width: 45%;
	}

	.LegendItem > span:last-child {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.LegendDot {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 9999px;
		flex: none;
	}

	.ClientDot,
	.ClientBar {
		fill: var(--color-primary);
		background: var(--color-primary);
	}

	.ComparisonDot,
	.ComparisonBar {
		fill: #e4d8fa;
		background: #e4d8fa;
	}

	.Graph {
		width: 100%;
		min-height: 0;
		flex: 1;
		overflow-x: auto;
		overflow-y: hidden;
		outline: none;
	}

	.Graph:focus-visible {
		border-radius: 0.5rem;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 35%, transparent);
	}

	svg {
		display: block;
		min-width: 100%;
		height: 100%;
		min-height: 19rem;
	}

	.GridLine {
		stroke: var(--color-border);
		stroke-width: 1;
	}

	.VolumeBar {
		fill: #faf8fd;
		stroke: #d9c8f7;
		stroke-width: 1;
		stroke-dasharray: 6 5;
	}

	.ComparisonBar {
		stroke: #cbb3f4;
		stroke-width: 1;
	}

	.AxisTick {
		fill: var(--color-text-light);
		font-size: 11px;
	}

	.AxisTitle,
	.XAxisTitle {
		fill: var(--color-base-content);
		font-size: 11px;
		font-weight: 700;
	}

	.BarLabel {
		font-size: 10px;
		font-weight: 700;
		text-anchor: start;
		pointer-events: none;
	}

	.ClientLabel {
		fill: white;
	}

	.ComparisonLabel,
	.ClusterLabel {
		fill: var(--color-base-content);
	}

	.ClusterLabel {
		font-size: 10px;
	}
</style>

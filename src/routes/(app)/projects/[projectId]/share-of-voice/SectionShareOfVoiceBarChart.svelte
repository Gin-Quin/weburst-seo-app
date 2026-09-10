<script lang="ts">
	import { wrapSvgLabel } from "$lib/charts/wrapSvgLabel";
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

	const content = defineContent({
		en: {
			competitors: "Strongest competitor",
			clusterShare: "Share of voice per cluster (%)",
			globalVolume: "Monthly searches",
			traffic: "Estimated visits",
			chartLabel: "Latest share of voice analysis by keyword cluster",
		},
		fr: {
			competitors: "Meilleur concurrent",
			clusterShare: "Part de voix par cluster (en %)",
			globalVolume: "Volume potentiel",
			traffic: "Visites mensuelles estimées",
			chartLabel: "Dernière analyse de part de voix par cluster",
		},
	});

	let {
		analysisResults,
		client,
	}: {
		analysisResults: AggregatedKeywordAnalysis;
		client: AggregatedKeywordAnalysisData;
	} = $props();

	const LEFT = 58;
	const RIGHT = 72;
	const TOP = 18;
	const BOTTOM_GUTTER = 36;
	const DEFAULT_HEIGHT = 326;
	let tooltipContainer: HTMLDivElement;
	let hoveredBar = $state<{
		item: ClusterBarChartData;
		series: "client" | "comparison";
		x: number;
		y: number;
	} | null>(null);

	function showBarTooltip(
		event: PointerEvent | FocusEvent,
		item: ClusterBarChartData,
		series: "client" | "comparison",
	) {
		const bar = (event.currentTarget as SVGRectElement).getBoundingClientRect();
		const container = tooltipContainer.getBoundingClientRect();
		hoveredBar = {
			item,
			series,
			x: bar.left + bar.width / 2 - container.left,
			y: bar.top - container.top,
		};
	}

	let graphWidth = $state(0);
	let graphHeight = $state(0);
	const chartHeight = $derived(graphHeight || DEFAULT_HEIGHT);
	const bottom = $derived(Math.max(TOP, chartHeight - BOTTOM_GUTTER));
	const plotHeight = $derived(bottom - TOP);

	const chartResult = $derived(
		getClusterBarChartData({
			clusters: analysisResults.clusters,
			clientDomain: client.domain,
		}),
	);
	const comparisonLabel = $derived($content.competitors);
	const chartWidth = $derived(
		Math.max(
			620,
			graphWidth,
			analysisResults.clusters.length * 92 + LEFT + RIGHT,
		),
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
	const volumeMax = $derived(
		Math.max(1, ...chartResult.data.map((item) => item.totalVolume)),
	);
	const shareTicks = $derived(
		Array.from({ length: 5 }, (_, index) => (shareMax / 4) * index),
	);
	function shareY(value: number): number {
		return bottom - (value / shareMax) * plotHeight;
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
		const slotWidth = Math.min(
			92,
			plotWidth / Math.max(1, chartResult.data.length),
		);
		const firstX = LEFT + (plotWidth - slotWidth * chartResult.data.length) / 2;
		const backgroundWidth = Math.min(74, slotWidth * 0.8);
		const gap = 4;
		const barWidth = (backgroundWidth - gap) / 2;
		const backgroundX =
			firstX + index * slotWidth + (slotWidth - backgroundWidth) / 2;
		const clientY = shareY(item.clientShare);
		const comparisonY = shareY(item.comparisonShare);

		return {
			centerX: firstX + index * slotWidth + slotWidth / 2,
			backgroundX,
			backgroundWidth,
			backgroundY: bottom - (item.totalVolume / volumeMax) * plotHeight,
			barWidth,
			clientX: backgroundX,
			clientY,
			clientHeight: bottom - clientY,
			comparisonX: backgroundX + barWidth + gap,
			comparisonY,
			comparisonHeight: bottom - comparisonY,
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

<div class="ChartPlot" bind:this={tooltipContainer}>
	<div
		class="Graph"
		onscroll={() => (hoveredBar = null)}
		tabindex="0"
		bind:clientWidth={graphWidth}
		bind:clientHeight={graphHeight}
	>
		<svg
			role="img"
			aria-label={$content.chartLabel}
			viewBox={`0 0 ${chartWidth} ${chartHeight}`}
			style={`width: ${chartWidth}px; height: 100%`}
		>
			{#each shareTicks as tick (tick)}
				{@const y = shareY(tick)}
				<line
					class="GridLine"
					x1={LEFT}
					x2={chartWidth - RIGHT}
					y1={y}
					y2={y}
				/>
				<text class="AxisTick" x={LEFT - 10} y={y + 4} text-anchor="end">
					{formatShareTick(tick)}
				</text>
				<text
					class="AxisTick"
					x={chartWidth - RIGHT + 10}
					y={y + 4}
					text-anchor="start"
				>
					{formatVolume((tick / shareMax) * volumeMax)}
				</text>
			{/each}

			<text
				class="AxisTitle"
				x="18"
				y={(TOP + bottom) / 2}
				text-anchor="middle"
				transform={`rotate(-90 18 ${(TOP + bottom) / 2})`}
			>
				{$content.clusterShare}
			</text>
			<text
				class="AxisTitle"
				x={chartWidth - 12}
				y={(TOP + bottom) / 2}
				text-anchor="middle"
				transform={`rotate(90 ${chartWidth - 12} ${(TOP + bottom) / 2})`}
			>
				{$content.globalVolume}
			</text>
			{#each chartResult.data as item, index (item.name)}
				{@const geometry = getGeometry(item, index)}
				{@const labelLines = wrapSvgLabel(item.name)}
				<rect
					class="VolumeBar"
					x={geometry.backgroundX}
					y={geometry.backgroundY}
					width={geometry.backgroundWidth}
					height={bottom - geometry.backgroundY}
					rx="9"
				>
					<title
						>{item.name} — {$content.globalVolume}: {item.totalVolume.toLocaleString(
							$locale,
						)}</title
					>
				</rect>
				<rect
					class="ClientBar"
					role="img"
					tabindex="0"
					aria-label={`${client.domain}: ${formatPercent(item.clientShare / 100)}`}
					onpointerenter={(event) => showBarTooltip(event, item, "client")}
					onpointerleave={() => (hoveredBar = null)}
					onfocus={(event) => showBarTooltip(event, item, "client")}
					onblur={() => (hoveredBar = null)}
					onkeydown={(event) => {
						if (event.key === "Escape") hoveredBar = null;
					}}
					x={geometry.clientX}
					y={geometry.clientY}
					width={geometry.barWidth}
					height={geometry.clientHeight}
					rx="5"
				>
				</rect>
				<rect
					class="ComparisonBar"
					role="img"
					tabindex="0"
					aria-label={`${item.comparisonDomain ?? $content.competitors}: ${formatPercent(item.comparisonShare / 100)}`}
					onpointerenter={(event) => showBarTooltip(event, item, "comparison")}
					onpointerleave={() => (hoveredBar = null)}
					onfocus={(event) => showBarTooltip(event, item, "comparison")}
					onblur={() => (hoveredBar = null)}
					onkeydown={(event) => {
						if (event.key === "Escape") hoveredBar = null;
					}}
					x={geometry.comparisonX}
					y={geometry.comparisonY}
					width={geometry.barWidth}
					height={geometry.comparisonHeight}
					rx="5"
				>
				</rect>

				{#if geometry.clientHeight > 34}
					<text
						class="BarLabel ClientLabel"
						x={geometry.clientX + geometry.barWidth / 2}
						y={bottom - 8}
						transform={`rotate(-90 ${geometry.clientX + geometry.barWidth / 2} ${bottom - 8})`}
					>
						{compactLabel(client.domain)}
					</text>
				{/if}
				<text
					class="ClusterLabel"
					x={geometry.centerX}
					y={bottom + 18}
					text-anchor="middle"
				>
					{#each labelLines as line, lineIndex (`${lineIndex}-${line}`)}
						<tspan x={geometry.centerX} dy={lineIndex === 0 ? 0 : 13}
							>{line}</tspan
						>
					{/each}
					<title>{item.name}</title>
				</text>
			{/each}
		</svg>
	</div>
	{#if hoveredBar}
		{@const isClient = hoveredBar.series === "client"}
		{@const domain = isClient
			? client.domain
			: (hoveredBar.item.comparisonDomain ?? $content.competitors)}
		{@const share = isClient
			? hoveredBar.item.clientShare
			: hoveredBar.item.comparisonShare}
		{@const volume = isClient
			? hoveredBar.item.clientVolume
			: hoveredBar.item.comparisonVolume}
		<div
			class="BarTooltip"
			role="tooltip"
			style:left={`clamp(0px, ${hoveredBar.x - 120}px, max(0px, 100% - 240px))`}
			style:bottom={`calc(100% - ${hoveredBar.y}px + 8px)`}
		>
			<strong>{domain}</strong>
			<span>{hoveredBar.item.name} · {formatPercent(share / 100)}</span>
			<span>{$content.traffic}: {volume.toLocaleString($locale)}</span>
			<span
				>{$content.globalVolume}: {hoveredBar.item.totalVolume.toLocaleString(
					$locale,
				)}</span
			>
		</div>
	{/if}
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

	.ChartPlot {
		position: relative;
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}

	.BarTooltip {
		position: absolute;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		width: 240px;
		max-width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: var(--color-base-100);
		color: var(--color-base-content);
		box-shadow: 0 4px 12px #0000001a;
		font-size: 0.75rem;
		overflow-wrap: anywhere;
		pointer-events: none;
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
		box-shadow: 0 0 0 2px
			color-mix(in srgb, var(--color-primary) 35%, transparent);
	}

	svg {
		display: block;
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

	.AxisTitle {
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

	.ClusterLabel {
		fill: var(--color-base-content);
	}

	.ClusterLabel {
		font-size: 10px;
	}
</style>

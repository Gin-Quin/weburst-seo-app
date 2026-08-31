<script lang="ts">
	import { chartColors } from "$lib/charts/chartColors";
	import type { ShareOfVoiceSnapshotItem } from "$lib/charts/getShareOfVoiceSnapshot";
	import { wrapSvgLabel } from "$lib/charts/wrapSvgLabel";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { formatPercent } from "$lib/numbers/formatPercent";

	const content = defineContent({
		en: {
			chartLabel: "Latest share of voice analysis by selected domain",
			shareOfVoice: "Share of voice",
		},
		fr: {
			chartLabel: "Dernière analyse de part de voix par domaine sélectionné",
			shareOfVoice: "Part de voix",
		},
	});

	let {
		data,
		clientDomain,
	}: {
		data: Array<ShareOfVoiceSnapshotItem>;
		clientDomain: string;
	} = $props();

	const LEFT = 58;
	const RIGHT = 24;
	const TOP = 8;
	const BOTTOM_GUTTER = 36;
	const DEFAULT_HEIGHT = 326;
	let graphWidth = $state(0);
	let graphHeight = $state(0);
	const chartHeight = $derived(graphHeight || DEFAULT_HEIGHT);
	const bottom = $derived(Math.max(TOP, chartHeight - BOTTOM_GUTTER));
	const plotHeight = $derived(bottom - TOP);
	const chartWidth = $derived(
		Math.max(620, graphWidth, data.length * 90 + LEFT + RIGHT),
	);
	const shareMax = $derived.by(() => {
		const highestShare = Math.max(0.1, ...data.map(({ share }) => share));
		return Math.min(1, Math.ceil(highestShare * 10) / 10);
	});
	const shareTicks = $derived(
		Array.from({ length: 6 }, (_, index) => (shareMax / 5) * index),
	);

	function shareY(value: number): number {
		return bottom - (value / shareMax) * plotHeight;
	}

	function getGeometry(item: ShareOfVoiceSnapshotItem, index: number) {
		const plotWidth = chartWidth - LEFT - RIGHT;
		const slotWidth = Math.min(90, plotWidth / Math.max(1, data.length));
		const firstX = LEFT + (plotWidth - slotWidth * data.length) / 2;
		const width = Math.min(54, slotWidth * 0.64);
		const x = firstX + index * slotWidth + (slotWidth - width) / 2;
		const y = shareY(item.share);

		return {
			x,
			y,
			width,
			height: bottom - y,
			centerX: x + width / 2,
		};
	}

	function getColor(domain: string, index: number): string {
		if (domain === clientDomain) return "var(--color-primary)";

		const competitorIndex = data
			.slice(0, index)
			.filter((item) => item.domain !== clientDomain).length;
		return chartColors[competitorIndex % chartColors.length]!;
	}
</script>

<div
	class="Graph"
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
			<line class="GridLine" x1={LEFT} x2={chartWidth - RIGHT} y1={y} y2={y} />
			<text class="AxisTick" x={LEFT - 10} y={y + 4} text-anchor="end">
				{formatPercent(tick, { maximumFractionDigits: 0 })}
			</text>
		{/each}

		<text
			class="AxisTitle"
			x="18"
			y={(TOP + bottom) / 2}
			text-anchor="middle"
			transform={`rotate(-90 18 ${(TOP + bottom) / 2})`}
		>
			{$content.shareOfVoice}
		</text>

		{#each data as item, index (item.domain)}
			{@const geometry = getGeometry(item, index)}
			{@const color = getColor(item.domain, index)}
			{@const labelLines = wrapSvgLabel(item.domain)}
			<rect
				x={geometry.x}
				y={geometry.y}
				width={geometry.width}
				height={geometry.height}
				rx="7"
				fill={color}
			>
				<title>{item.domain}: {formatPercent(item.share)}</title>
			</rect>
			<text
				class="ValueLabel"
				x={geometry.centerX}
				y={Math.max(TOP + 12, geometry.y - 7)}
				text-anchor="middle"
			>
				{formatPercent(item.share)}
			</text>
			<text
				class:ClientLabel={item.domain === clientDomain}
				class="DomainLabel"
				x={geometry.centerX}
				y={bottom + 18}
				text-anchor="middle"
			>
				{#each labelLines as line, lineIndex (`${lineIndex}-${line}`)}
					<tspan x={geometry.centerX} dy={lineIndex === 0 ? 0 : 13}>{line}</tspan>
				{/each}
				<title>{item.domain}</title>
			</text>
		{/each}
	</svg>
</div>

<style>
	.Graph {
		width: 100%;
		height: 100%;
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
	}

	.GridLine {
		stroke: var(--color-border);
		stroke-width: 1;
	}

	.AxisTick,
	.DomainLabel,
	.ValueLabel {
		fill: var(--color-text-light);
		font-size: 11px;
	}

	.AxisTitle,
	.ValueLabel,
	.ClientLabel {
		fill: var(--color-base-content);
		font-weight: 700;
	}

	.AxisTitle {
		font-size: 11px;
	}
</style>

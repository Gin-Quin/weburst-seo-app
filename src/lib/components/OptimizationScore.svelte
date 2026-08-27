<script lang="ts">
	import { getOptimizationScoreTone } from "$lib/contents/optimization";

	type Variant = "badge" | "card";
	type Size = "small" | "regular";

	let {
		score,
		label = "Score",
		suffix = "",
		caption,
		variant = "badge",
		size = "small",
	}: {
		score: number | null | undefined;
		label?: string;
		suffix?: string;
		caption?: string;
		variant?: Variant;
		size?: Size;
	} = $props();

	const roundedScore = $derived(score == null ? null : Math.round(score));
	const tone = $derived(roundedScore == null ? "neutral" : getOptimizationScoreTone(roundedScore));
</script>

<span class="OptimizationScore {variant} size-{size} {tone}">
	{#if variant === "card"}
		<strong>{roundedScore ?? "—"}{roundedScore == null ? "" : suffix}</strong>
		{#if caption}<small>{caption}</small>{/if}
	{:else}
		{#if label}<span>{label}</span>{/if}
		<strong>{roundedScore ?? "—"}{roundedScore == null ? "" : suffix}</strong>
	{/if}
</span>

<style>
	.OptimizationScore { border: 1px solid; white-space: nowrap; }
	.bad { color: #aa1118; background: #fff0f1; border-color: #ffb9bd; }
	.mid { color: #a65a00; background: #fff8df; border-color: #f4d477; }
	.good { color: #0c7a25; background: #e8ffed; border-color: #a4efb1; }
	.neutral { color: var(--color-text-light); background: #f1f1f1; border-color: var(--color-border); }
	.badge { display: inline-flex; align-items: baseline; gap: 0.3rem; border-radius: 0.5rem; line-height: 1.2; }
	.badge.size-small { padding: 0.25rem 0.4rem; font-size: calc(0.85rem - 1px); }
	.badge.size-regular { padding: 0.3rem 0.45rem; font-size: 1rem; }
	.badge.size-small strong { font-size: calc(0.85rem + 1px); }
	.badge.size-regular strong { font-size: 1.08rem; }
	.card { flex: 0 0 4.5rem; width: 4.5rem; min-height: 5rem; border-radius: 0.65rem; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
	.card strong { font-size: 2.3rem; font-weight: 500; }
	.card small { margin-top: 0.35rem; font-size: 0.78rem; white-space: nowrap; }
	@media (max-width: 520px) {
		.card { flex-basis: 4rem; width: 4rem; min-height: 4.5rem; }
		.card strong { font-size: 2rem; }
	}
</style>

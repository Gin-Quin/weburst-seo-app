<script lang="ts">
	import { locale } from "$lib/i18n/locale.svelte";
	import { formatTrendPeriod } from "$lib/keywords/formatTrendPeriod";
	import { formatPercent } from "$lib/numbers/formatPercent";
	import IconArrowDownRegular from "phosphor-icons-svelte/IconArrowDownRegular.svelte";
	import IconArrowUpRegular from "phosphor-icons-svelte/IconArrowUpRegular.svelte";

	let {
		trend,
		days,
		size = "sm",
	}: { trend: number | null | undefined; days?: number; size?: "xs" | "sm" } = $props();
</script>

{#if trend && trend >= 0.1}
	<div title={formatTrendPeriod(days, $locale)} class="badge badge-success">
		<IconArrowUpRegular class="text-small" />
		<span class={size === "xs" ? "text-xs" : "text-sm"}>
			{formatPercent(trend)}
		</span>
	</div>
{:else if trend && trend < -0.1}
	<div title={formatTrendPeriod(days, $locale)} class="badge badge-warning">
		<IconArrowDownRegular class="text-small" />
		<span class={size === "xs" ? "text-xs" : "text-sm"}>
			{formatPercent(trend)}
		</span>
	</div>
{/if}

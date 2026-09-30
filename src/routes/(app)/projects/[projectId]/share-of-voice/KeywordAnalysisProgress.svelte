<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { KeywordAnalysisStatus } from "$lib/server/clickhouse/services/keywords";

	const content = defineContent({
		en: {
			title: "Analysis in progress...",
			retrying: "Retrying keywords:",
			partial: "Partial analysis",
			failed: "The analysis was stopped because an error prevented it from completing. No results from this analysis are published. Please try again later.",
			partialResults: "No keyword could be fully analysed after retrying. Please try again later.",
		},
		fr: {
			title: "Analyse en cours...",
			retrying: "Mots-clés en cours de nouvelle tentative :",
			partial: "Analyse partielle",
			failed: "L’analyse a été interrompue car une erreur a empêché son achèvement. Aucun résultat de cette analyse n’est publié. Veuillez réessayer ultérieurement.",
			partialResults: "Aucun mot-clé n’a pu être entièrement analysé après les nouvelles tentatives. Veuillez réessayer ultérieurement.",
		},
	});

	let { analysis }: { analysis: KeywordAnalysisStatus } = $props();

	let { completedTasks, failedTasks, keywordsCount, totalTasks, status } =
		$derived(analysis);
	let done = $derived(status === "completed");

</script>

{#if status === "failed"}
	<p class="text-error text-xs max-w-xl" role="alert">
		{analysis.failureReason === "partial_results" ? $content.partialResults : $content.failed}
	</p>
{:else if done && failedTasks > 0}
	<p class="text-warning text-xs" role="status">{$content.partial} · {completedTasks}/{keywordsCount}</p>
{:else}
<div
	class="KeywordAnalysisProgress col gap-1 pb-[0.25rem] items-center justify-center w-[10rem] {done
		? 'opacity-0'
		: 'opacity-100'}"
	class:done
>
	<div class="description text-xs!">
		{$content.title}
		{#if analysis.retryingTasks > 0}<span class="block">{$content.retrying} {analysis.retryingTasks}</span>{/if}
	</div>
	<div
		class="row w-full h-1 rounded-full overflow-hidden"
		style:background-color="var(--color-border)"
	>
		<div
			class="progress left-0 top-0 h-full bg-primary"
			style:width="{keywordsCount > 0 ? Math.min(100, (100 * (completedTasks + failedTasks)) / keywordsCount) : 0}%"
		></div>
	</div>
</div>
{/if}

<style>
	.progress {
		transition: width 100ms ease-in-out;
	}

	.KeywordAnalysisProgress {
		width: clamp(7rem, 12vw, 10rem);
		min-width: 7rem;
		flex: 0 1 10rem;
		transition: opacity 300ms ease-in-out;
		transition-delay: 700ms;
	}

	.KeywordAnalysisProgress.done {
		width: 0;
		height: 0;
		min-width: 0;
		flex-basis: 0;
		overflow: hidden;
		padding: 0;
		pointer-events: none;
	}
</style>

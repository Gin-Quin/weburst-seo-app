<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { KeywordAnalysisStatus } from "$lib/server/clickhouse/services/keywords";

	const content = defineContent({
		en: {
			title: "Analysis in progress...",
		},
		fr: {
			title: "Analyse en cours...",
		},
	});

	let { analysis }: { analysis: KeywordAnalysisStatus } = $props();

	let { completedTasks, failedTasks, keywordsCount, totalTasks } =
		$derived(analysis);
	let done = $derived(completedTasks + failedTasks === keywordsCount);

	$inspect({
		completedTasks,
		failedTasks,
		keywordsCount,
		totalTasks,
	});
</script>

<div
	class="KeywordAnalysisProgress col gap-1 pb-[0.25rem] items-center justify-center w-[10rem] {done
		? 'opacity-0'
		: 'opacity-100'}"
	class:done
>
	<div class="description text-xs!">
		{$content.title}
	</div>
	<div
		class="row w-full h-1 rounded-full overflow-hidden"
		style:background-color="var(--color-border)"
	>
		<div
			class="progress left-0 top-0 h-full bg-primary"
			style:width="{(100 * completedTasks) / keywordsCount}%"
		></div>
	</div>
</div>

<style>
	.done,
	.progress {
		transition: width 100ms ease-in-out;
	}

	.KeywordAnalysisProgress {
		transition: opacity 300ms ease-in-out;
		transition-delay: 700ms;
	}
</style>

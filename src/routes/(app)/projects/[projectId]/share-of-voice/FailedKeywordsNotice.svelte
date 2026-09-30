<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	let { keywords, completedCount, totalCount, pending = false }: {
		keywords: string[]; completedCount: number; totalCount: number; pending?: boolean;
	} = $props();
	const content = defineContent({
		fr: {
			title: "Mots-clés non analysés",
			coverage: "mots-clés analysés avec succès",
			pending: "L’analyse continue pour les autres mots-clés.",
			excluded: "Les mots-clés ci-dessous sont exclus des calculs de trafic, de volume, de part de voix et des groupes de similarité.",
			trends: "Les indicateurs d’évolution sont indisponibles pour cette analyse partielle.",
		},
		en: {
			title: "Keywords that could not be analysed",
			coverage: "keywords successfully analysed",
			pending: "Analysis continues for the other keywords.",
			excluded: "The keywords below are excluded from traffic, volume, share of voice and similarity calculations.",
			trends: "Change indicators are unavailable for this partial analysis.",
		},
	});
</script>

{#if keywords.length > 0}
	<details class="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm" open>
		<summary class="cursor-pointer font-semibold">{$content.title} ({keywords.length})</summary>
		<p class="mt-2">{completedCount} / {totalCount} {$content.coverage}.</p>
		<p>{pending ? $content.pending : $content.excluded}</p>
		{#if !pending && completedCount > 0}<p>{$content.trends}</p>{/if}
		<ul class="mt-2 max-h-48 list-disc overflow-y-auto pl-5">
			{#each keywords as keyword (keyword)}<li>{keyword}</li>{/each}
		</ul>
	</details>
{/if}

<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";

	const content = defineContent({
		en: {
			title: "Competitive Mapping",
			description:
				"Comparative analysis of domains by share of voice and keyword volume.",
		},
		fr: {
			title: "Cartographie de la concurrence",
			description:
				"Analyse comparative des domaines par part de voix et volume de mots-clés.",
		},
	});
</script>

<div class="card">
	<header>
		<div class="title">
			{$content.title}
		</div>
		<div class="description">
			{$content.description}
		</div>
	</header>

	<main>TODO</main>
</div>

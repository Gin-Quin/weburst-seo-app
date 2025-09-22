<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";

	const content = defineContent({
		en: {
			title: "URL Analysis",
			description:
				"Detail of keywords related to each URL and their performance (positions, volumes).",
		},
		fr: {
			title: "Analyse par URL",
			description:
				"Détail des mots-clés liés à chaque URL et de leur performance (positions, volumes).",
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

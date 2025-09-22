<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";

	const content = defineContent({
		en: {
			title: "Clusters",
			description:
				"Discover related keyword clusters: main keyword, volume, and secondary keywords.",
		},
		fr: {
			title: "Groupes similaires",
			description:
				"Découvrez les groupes de mots-clés liés : mot-clé principal, volume et mots-clés secondaires.",
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

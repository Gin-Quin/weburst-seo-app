<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";

	const content = defineContent({
		en: {
			title: "SEO Potential",
			description: "Estimated traffic from positions not yet exploited.",
		},
		fr: {
			title: "Potentiel SEO",
			description:
				"Trafic SEO potentiel sur les positions pas encore exploitées.",
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

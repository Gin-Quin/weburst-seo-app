<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import IconDownloadSimpleRegular from "phosphor-icons-svelte/IconDownloadSimpleRegular.svelte";
	import IconListPlusRegular from "phosphor-icons-svelte/IconListPlusRegular.svelte";
	import IconExportRegular from "phosphor-icons-svelte/IconExportRegular.svelte";
	import IconVectorThreeRegular from "phosphor-icons-svelte/IconVectorThreeRegular.svelte";
	import ProjectSettingsDropdown from "../ProjectSettingsDropdown.svelte";
	import SectionClusters from "./SectionClusters.svelte";
	import SectionUrlAnalysis from "./SectionUrlAnalysis.svelte";

	const content = defineContent({
		en: {
			addKeywords: "Add Keywords",
			connectGoogleSearchConsole: "Connect Google Search Console",
			exportAsGoogleSheet: "Export as Google Sheet",
			recalculateSemanticCocoons: "Recalculate Semantic Cocoons",
		},
		fr: {
			addKeywords: "Ajouter des mots-clés",
			connectGoogleSearchConsole: "Connecter Google Search Console",
			exportAsGoogleSheet: "Exporter en Google Sheet",
			recalculateSemanticCocoons: "Recalculer les cocons",
		},
	});
</script>

<div class="Page px-10 py-8 w-full gap-5 grid">
	<header class="row justify-between gap-3">
		<div class="row justify-between gap-3">
			<button class="btn">
				<IconDownloadSimpleRegular class="icon text-accent" />
				{$content.addKeywords}
			</button>
			<button class="btn">
				<IconListPlusRegular class="icon text-accent" />
				{$content.connectGoogleSearchConsole}
			</button>
			<button class="btn">
				<IconExportRegular class="icon text-accent" />
				{$content.exportAsGoogleSheet}
			</button>
			<button class="btn">
				<IconVectorThreeRegular class="icon text-accent" />
				{$content.recalculateSemanticCocoons}
			</button>
		</div>

		<div class="row justify-between gap-3">
			<ProjectSettingsDropdown />
		</div>
	</header>

	<SectionClusters />
	<SectionUrlAnalysis />
</div>

<style>
	.Page {
		height: calc(100dvh - var(--app-header-height));
		grid-template-columns: 1fr;
		grid-template-rows: 2.5rem 1fr 1fr;
	}
</style>

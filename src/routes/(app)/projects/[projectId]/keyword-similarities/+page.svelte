<script lang="ts">
	import Loader from "$lib/components/Loader.svelte";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { context } from "$lib/stores/context.svelte";
	import IconDownloadSimpleRegular from "phosphor-icons-svelte/IconDownloadSimpleRegular.svelte";
	import IconExportRegular from "phosphor-icons-svelte/IconExportRegular.svelte";
	import { toast } from "svelte-sonner";
	import { getKeywordClusters } from "../../../../api/keywords/index.remote";
	import ProjectSettingsDropdown from "../ProjectSettingsDropdown.svelte";
	import SectionClusters from "./SectionClusters.svelte";

	const content = defineContent({
		en: {
			addKeywords: "Add Keywords",
			export: "Export as CSV",
			noAnalysisResults:
				"No data available. Add keywords and start an analysis.",
			mainKeyword: "Main Keyword",
			keywordVolume: "Main Keyword Volume",
			associatedKeywords: "Secondary Keywords",
			totalVolume: "Total Volume",
			positionnedPages: "Positionned Pages",
			noPosition: "No page positionned",
			duplicationWithOtherPage: "Duplication with other page",
			yes: "Yes",
			no: "No",
		},
		fr: {
			addKeywords: "Ajouter des mots-clés",
			export: "Exporter en CSV",
			noAnalysisResults:
				"Aucune donnée disponible. Ajoutez des mots-clés et lancez une analyse.",
			mainKeyword: "Mot-clé principal",
			keywordVolume: "Volume du mot-clé principal",
			associatedKeywords: "Mots-clés secondaires",
			totalVolume: "Volume total",
			positionnedPages: "Pages positionnées",
			noPosition: "Aucune page positionnée",
			duplicationWithOtherPage: "Duplication avec une autre page",
			yes: "Oui",
			no: "Non",
		},
	});

	const queryKeywordClusters = getKeywordClusters({
		projectId: context.project!.id,
	});

	async function exportData() {
		const clusters = await queryKeywordClusters;
		if (!clusters) {
			toast.error($content.noAnalysisResults);
			return;
		}

		const headers = [
			$content.mainKeyword,
			$content.associatedKeywords,
			$content.keywordVolume,
			$content.totalVolume,
			$content.positionnedPages,
			$content.duplicationWithOtherPage,
		];

		const esc = (val: unknown) => {
			const str = (val ?? "").toString();
			const escaped = str.replace(/"/g, '""');
			return `"${escaped}"`;
		};

		const rows = clusters.map((cluster) => {
			const main = cluster[0];
			if (!main) return [];

			const mainKeyword =
				(main.keyword ?? "") + (main.volume != null ? ` (${main.volume})` : "");
			const associated = (cluster?.slice(1) ?? [])
				.map(({ keyword, volume }) => `${keyword} (${volume})`)
				.join(", ");
			const totalVolume = (cluster ?? []).reduce(
				(acc, it) => acc + (it?.volume ?? 0),
				0,
			);
			const urlList = (cluster ?? [])
				.flatMap((c) => c?.items ?? [])
				.filter((item) => item?.domain == context.project!.domain)
				.map((item) => item?.url)
				.filter((u) => !!u);
			const urls = urlList.length ? urlList.join(", ") : "-";

			const duplicated = urlList.length > 1 ? $content.yes : $content.no;

			return [
				mainKeyword,
				associated,
				main.volume,
				totalVolume,
				urls,
				duplicated,
			];
		});

		const csv =
			"\ufeff" +
			[headers, ...rows].map((row) => row.map(esc).join(",")).join("\n");

		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = context.project?.domain
			? `clusters_${context.project.domain}.csv`
			: "clusters.csv";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}
</script>

<div class="Page px-10 py-8 w-full gap-5 grid">
	<header class="row justify-between gap-3">
		<div class="row justify-between gap-3">
			<button class="btn">
				<IconDownloadSimpleRegular class="icon text-accent" />
				{$content.addKeywords}
			</button>
			<!-- <button class="btn">
				<IconListPlusRegular class="icon text-accent" />
				{$content.connectGoogleSearchConsole}
			</button> -->
			<button class="btn" on:click={exportData}>
				<IconExportRegular class="icon text-accent" />
				{$content.export}
			</button>
		</div>

		<div class="row justify-between gap-3">
			<ProjectSettingsDropdown />
		</div>
	</header>

	{#await queryKeywordClusters}
		<Loader />
	{:then clusters}
		{#if clusters == null}
			<div class="center text-xl text-light bold">
				{$content.noAnalysisResults}
			</div>
		{:else}
			<SectionClusters {clusters} />
			<!-- <SectionUrlAnalysis /> -->
		{/if}
	{/await}
</div>

<style>
	.Page {
		height: calc(100dvh - var(--app-header-height));
		grid-template-columns: 1fr;
		grid-template-rows: 2.5rem 1fr /*1fr*/;
		min-height: 600px;
	}
</style>

import { defineContent } from "$lib/i18n/locale.svelte";
import type { KeywordCluster } from "$lib/server/clickhouse/services/keywords";
import { context } from "$lib/stores/context.svelte";
import { toast } from "svelte-sonner";
import { get } from "svelte/store";

	const content = defineContent({
		en: {
			mainKeyword: "Main Keyword",
			keywordVolume: "Main Keyword Volume",
			associatedKeywords: "Secondary Keywords",
			totalVolume: "Total Volume",
			positionnedPages: "Positionned Pages",
			noPosition: "No page positionned",
			duplicationWithOtherPage: "Duplication with other page",
			yes: "Yes",
			no: "No",
			noAnalysisResults:
				"No data available. Add keywords and start an analysis.",
		},
		fr: {
			mainKeyword: "Mot-clé principal",
			keywordVolume: "Volume du mot-clé principal",
			associatedKeywords: "Mots-clés secondaires",
			totalVolume: "Volume total",
			positionnedPages: "Pages positionnées",
			noPosition: "Aucune page positionnée",
			duplicationWithOtherPage: "Duplication avec une autre page",
			yes: "Oui",
			no: "Non",
			noAnalysisResults:
				"Aucune donnée disponible. Ajoutez des mots-clés et lancez une analyse.",

		},
	});

	export async function exportDataToCsv(clusters: KeywordCluster[]) {
		const $content = get(content)

		// const clusters = await queryKeywordClusters;
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

			const mainKeyword = main.keyword;
			const associated = (cluster?.slice(1) ?? [])
				.map(({ keyword }) => keyword)
				.join(", ");
			const totalVolume = (cluster ?? []).reduce(
				(acc, it) => acc + (it?.volume ?? 0),
				0,
			);
			const urlList = (cluster ?? [])
				.flatMap((c) => c?.items ?? [])
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

import type { KeywordTuple } from "$lib/server/clickhouse/services/keywords";
import Papa from "papaparse";

function normalizeHeader(value: string | undefined): string {
	return (value ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function findHeaderIndex(row: string[], names: string[]): number {
	return row.findIndex((value) => {
		const header = normalizeHeader(value);
		return names.some((name) => header.includes(name));
	});
}

export async function parseKeywordsCsv(file: File | string): Promise<Array<KeywordTuple> | Error> {
	try {
		const raw = file instanceof File ? await file.text() : file;
		const { data, errors } = Papa.parse<string[]>(raw, {
			header: false,
			dynamicTyping: false,
			delimitersToGuess: [",", ";", "\t"],
			skipEmptyLines: "greedy",
		});
		if (errors.length) {
			errors.map((error) => console.error(error));
			return new Error(`Failed to parse CSV file: ${errors.join(", ")}`);
		}
		if (!data.length) {
			return [];
		}

		const firstRow = data[0]!;
		const keywordIndex = findHeaderIndex(firstRow, ["keywords", "keyword", "mots cles", "mot cle"]);
		const volumeIndex = findHeaderIndex(firstRow, ["volume"]);
		const clusterIndex = findHeaderIndex(firstRow, [
			"clusters",
			"cluster",
			"categories",
			"categorie",
			"category",
			"groupes",
			"groupe",
		]);
		const hasNamedColumns = keywordIndex >= 0 && volumeIndex >= 0;
		const hasHeader = hasNamedColumns || Number.isNaN(Number(firstRow[1]));

		return data
			.slice(hasHeader ? 1 : 0)
			.map((row) => {
				const name = row[hasNamedColumns ? keywordIndex : 0]?.trim();
				const volume = row[hasNamedColumns ? volumeIndex : 1]?.trim();
				const cluster = row[hasNamedColumns ? clusterIndex : 2]?.trim() ?? "";
				return [name, volume, cluster] as const;
			})
			.filter(([name, volume]) => Boolean(name && volume))
			.map(([name, volume, cluster]) => [name!, Number(volume), cluster] as KeywordTuple)
			.filter(([, volume]) => Number.isFinite(volume));
	} catch (error) {
		console.error(error);
		return new Error(`Failed to parse CSV file: ${error}`);
	}
}

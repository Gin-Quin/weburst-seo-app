import type { KeywordTuple } from "$lib/server/clickhouse/services/keywords";
import Papa from "papaparse";

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
		const hasHeader = Number.isNaN(Number(data[0]![1]));
		return data
			.slice(hasHeader ? 1 : 0)
			.filter((row) => (row.length === 2 || row.length === 3) && row[0]?.trim() && row[1]?.trim())
			.map((row) => [row[0]!.trim(), Number(row[1]), row[2]?.trim() ?? ""] as KeywordTuple)
			.filter(([, volume]) => Number.isFinite(volume));
	} catch (error) {
		console.error(error);
		return new Error(`Failed to parse CSV file: ${error}`);
	}
}

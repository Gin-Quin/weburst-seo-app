import type { KeywordTuple } from "$lib/server/clickhouse/services/keywords";
import Papa from "papaparse";

export async function parseKeywordsCsv(file: File): Promise<Array<KeywordTuple> | Error> {
	const raw = await file.text();
	const { data, errors } = Papa.parse<[string, string]>(raw, {
		header: false,
		dynamicTyping: false,
	});
	if (errors.length) {
		errors.map((error) => console.error(error));
		return new Error(`Failed to parse CSV file: ${errors.join(", ")}`);
	}
	if (!data.length) {
		return [];
	}
	const hasHeader = Number.isNaN(parseInt(data[0][1], 10));
	return data.slice(hasHeader ? 1 : 0).map((row) => [row[0], parseInt(row[1], 10)]);
}

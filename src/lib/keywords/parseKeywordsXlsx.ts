import type { KeywordTuple } from "$lib/server/clickhouse/services/keywords";
import * as XLSX from "xlsx";

export async function parseKeywordsXlsx(file: File): Promise<Array<KeywordTuple> | Error> {
	try {
		const buffer = await file.arrayBuffer();
		const workbook = XLSX.read(buffer, { type: "array" });

		// Get the first worksheet
		const sheetName = workbook.SheetNames[0];
		if (!sheetName) {
			return new Error("No worksheets found in XLSX file");
		}

		const worksheet = workbook.Sheets[sheetName];
		if (!worksheet) {
			return new Error("Failed to read worksheet");
		}

		// Convert to array of arrays
		const data = XLSX.utils.sheet_to_json<[string, string]>(worksheet, {
			header: 0,
			raw: false,
			defval: "",
		});

		if (!data.length) {
			return [];
		}

		// Check if first row is a header by trying to parse the second column as a number
		const hasHeader = Number.isNaN(parseInt(data[0][1], 10));

		return data
			.slice(hasHeader ? 1 : 0)
			.filter((row) => row.length >= 2 && row[0] && row[1]) // Filter out empty rows
			.map((row) => [row[0], parseInt(row[1], 10)]);
	} catch (error) {
		return new Error(
			`Failed to parse XLSX file: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

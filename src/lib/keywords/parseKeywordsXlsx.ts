import type { KeywordTuple } from "$lib/server/clickhouse/services/keywords";
import * as XLSX from "xlsx";
import { parseKeywordsCsv } from "./parseKeywordsCsv";

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

		const data = XLSX.utils.sheet_to_csv(worksheet);
		return parseKeywordsCsv(data);
	} catch (error) {
		return new Error(
			`Failed to parse XLSX file: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

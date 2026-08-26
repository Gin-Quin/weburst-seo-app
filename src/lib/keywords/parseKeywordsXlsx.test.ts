import { describe, expect, test } from "bun:test";
import * as XLSX from "xlsx";
import { parseKeywordsXlsx } from "./parseKeywordsXlsx";

describe("parseKeywordsXlsx", () => {
	test("preserves the clusters column from a workbook", async () => {
		const workbook = XLSX.utils.book_new();
		const worksheet = XLSX.utils.aoa_to_sheet([
			["Keyword", "Volume", "clusters"],
			["technical seo", 1200, "SEO"],
			["content brief", 350, "Content"],
		]);
		XLSX.utils.book_append_sheet(workbook, worksheet, "Keywords");
		const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
		const file = new File([data], "keywords.xlsx", {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		});

		expect(await parseKeywordsXlsx(file)).toEqual([
			["technical seo", 1200, "SEO"],
			["content brief", 350, "Content"],
		]);
	});
});

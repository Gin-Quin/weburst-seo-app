import { describe, expect, test } from "bun:test";
import { parseKeywordsCsv } from "./parseKeywordsCsv";

describe("parseKeywordsCsv", () => {
	test("parses the new clusters column", async () => {
		expect(
			await parseKeywordsCsv(
				"Keyword,Search Volume,clusters\ntechnical seo,1200,SEO\ncontent brief,350,Content",
			),
		).toEqual([
			["technical seo", 1200, "SEO"],
			["content brief", 350, "Content"],
		]);
	});

	test("keeps two-column files backwards compatible", async () => {
		expect(await parseKeywordsCsv("keyword;volume\nseo audit;90")).toEqual([["seo audit", 90, ""]]);
	});

	test("supports headless tab-separated files and trims values", async () => {
		expect(
			await parseKeywordsCsv(" keyword one \t42\t Cluster A \nkeyword two\t12\tCluster B"),
		).toEqual([
			["keyword one", 42, "Cluster A"],
			["keyword two", 12, "Cluster B"],
		]);
	});

	test("ignores malformed rows and rows with invalid volumes", async () => {
		expect(
			await parseKeywordsCsv(
				"Keyword,Volume,clusters\nvalid,10,A\ntoo,many,columns,here\ninvalid,nope,A\nmissing-volume,,A",
			),
		).toEqual([["valid", 10, "A"]]);
	});
});

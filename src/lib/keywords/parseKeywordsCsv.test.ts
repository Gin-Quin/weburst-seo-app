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

	test("detects French columns regardless of their order", async () => {
		expect(
			await parseKeywordsCsv(
				"Catégorie,Mot-clé,Volume / mois\nSalaire & droit,salaire brut en net,58000\nIntérim & contrats,intérim,9900",
			),
		).toEqual([
			["salaire brut en net", 58000, "Salaire & droit"],
			["intérim", 9900, "Intérim & contrats"],
		]);
	});

	test("detects English columns regardless of their order", async () => {
		expect(await parseKeywordsCsv("Category,Search keyword,Volume\nSEO,seo audit,90")).toEqual([
			["seo audit", 90, "SEO"],
		]);
	});

	test("detects column names by partial, case-insensitive matches", async () => {
		expect(
			await parseKeywordsCsv(
				"GROUPE thématique,Monthly VOLUME (France),Primary KEYWORDS list\nTechnique,1200,audit seo",
			),
		).toEqual([["audit seo", 1200, "Technique"]]);
	});

	test.each(["cluster", "clusters", "catégorie", "catégories", "groupe", "groupes"])(
		"detects %s inside a cluster column name",
		async (clusterHeader) => {
			expect(
				await parseKeywordsCsv(
					`Nom du ${clusterHeader} principal,Mot-clé cible,Volume / mois\nSEO,audit seo,90`,
				),
			).toEqual([["audit seo", 90, "SEO"]]);
		},
	);

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

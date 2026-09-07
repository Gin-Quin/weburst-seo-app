import { expect, test } from "bun:test";
import { getClusterHistory } from "./getClusterHistory";

test("calculates each crawl using its keyword volumes and keeps zero-client dates", () => {
	const rows = getClusterHistory([{ id: "a", createdAt: "2026-09-01" }, { id: "b", createdAt: "2026-09-02" }], [
		{ analysisId: "a", keyword: "seo", keywordVolume: 100, domain: "client.fr", position: 1, type: "organic" },
		{ analysisId: "a", keyword: "seo", keywordVolume: 100, domain: "client.fr", position: 2, type: "organic" },
		{ analysisId: "a", keyword: "seo", keywordVolume: 100, domain: "other.fr", position: 1, type: "organic" },
	], "client.fr");
	expect(rows[0]!.volume / rows[0]!.totalVolume).toBe(0.5);
	expect(rows.at(-1)).toEqual({ createdAt: "2026-09-02", domain: "client.fr", volume: 0, totalVolume: 0 });
});

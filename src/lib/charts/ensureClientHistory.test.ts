import { expect, test } from "bun:test";
import { ensureClientHistory } from "./ensureClientHistory";

test("retains completed crawl dates even when no domains rank", () => {
	expect(ensureClientHistory([], [{ createdAt: "2026-09-07" }], "client.fr")).toEqual([
		{ createdAt: "2026-09-07", domain: "client.fr", volume: 0, totalVolume: 0 },
	]);
});

test("preserves actual client values and uses the full denominator for missing dates", () => {
	const rows = ensureClientHistory([
		{ createdAt: "2026-09-01", domain: "client.fr", volume: 10, totalVolume: 100 },
		{ createdAt: "2026-09-07", domain: "competitor.fr", volume: 20, totalVolume: 200 },
	], [{ createdAt: "2026-09-01" }, { createdAt: "2026-09-07" }], "client.fr");
	expect(rows.filter((row) => row.domain === "client.fr")).toEqual([
		{ createdAt: "2026-09-01", domain: "client.fr", volume: 10, totalVolume: 100 },
		{ createdAt: "2026-09-07", domain: "client.fr", volume: 0, totalVolume: 200 },
	]);
});

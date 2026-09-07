import { expect, test } from "bun:test";
import { getShareOfVoiceHistory } from "./getShareOfVoiceHistory";

test("keeps crawl dates and zero client values even when only competitors rank", () => {
	const rows = getShareOfVoiceHistory([
		{ createdAt: "2026-09-02", domain: "competitor.fr", volume: 20, totalVolume: 40 },
		{ createdAt: "2026-09-01", domain: "client.fr", volume: 10, totalVolume: 40 },
	], ["client.fr"]);
	expect(rows).toEqual([
		{ date: new Date("2026-09-01"), "client.fr": 25 },
		{ date: new Date("2026-09-02"), "client.fr": 0 },
	]);
});

test("zero traffic remains finite", () => {
	expect(getShareOfVoiceHistory([
		{ createdAt: "2026-09-01", domain: "client.fr", volume: 0, totalVolume: 0 },
	], ["client.fr"])[0]?.["client.fr"]).toBe(0);
});

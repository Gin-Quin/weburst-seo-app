import { expect, test } from "bun:test";
import { getShareOfVoiceHistory } from "$lib/charts/getShareOfVoiceHistory";
import { mergeWwwDomains } from "./mergeWwwDomains";

test("merges www and bare domains per group, keeping other domains untouched", () => {
	const rows = [
		{ at: "a", domain: "www.fnac.com", volume: 10, count: 2, trend: 5 },
		{ at: "a", domain: "fnac.com", volume: 3, count: 1, trend: 1 },
		{ at: "b", domain: "www.fnac.com", volume: 7, count: 4, trend: 2 },
		{ at: "a", domain: "verty.eu", volume: 1, count: 1, trend: 0 },
	];
	expect(mergeWwwDomains(rows, ["volume", "count"], (row) => row.at)).toEqual([
		{ at: "a", domain: "fnac.com", volume: 13, count: 3, trend: 5 },
		{ at: "b", domain: "fnac.com", volume: 7, count: 4, trend: 2 },
		{ at: "a", domain: "verty.eu", volume: 1, count: 1, trend: 0 },
	]);
});

test("share of voice history has no fake 0% when old analyses stored www. hosts", () => {
	// Real case: the June crawl stored www.fnac.com, the September crawl stores fnac.com.
	const rows = mergeWwwDomains([
		{ createdAt: "2026-06-17", domain: "www.fnac.com", volume: 6867, totalVolume: 60921 },
		{ createdAt: "2026-06-17", domain: "verty.eu", volume: 2165, totalVolume: 60921 },
		{ createdAt: "2026-09-30", domain: "fnac.com", volume: 3196, totalVolume: 34394 },
		{ createdAt: "2026-09-30", domain: "verty.eu", volume: 1697, totalVolume: 34394 },
	], ["volume"], (row) => row.createdAt);
	const [june, september] = getShareOfVoiceHistory(rows, ["fnac.com", "verty.eu"]);
	expect(june?.["fnac.com"]).toBeCloseTo(11.27, 1);
	expect(september?.["fnac.com"]).toBeCloseTo(9.29, 1);
});

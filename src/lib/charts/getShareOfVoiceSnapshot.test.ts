import { describe, expect, test } from "bun:test";
import { countShareOfVoiceAnalyses, getShareOfVoiceSnapshot } from "./getShareOfVoiceSnapshot";

const data = [
	{
		createdAt: "2026-08-27T09:00:00Z",
		domain: "client.fr",
		volume: 40,
		totalVolume: 100,
	},
	{
		createdAt: "2026-08-27T09:00:00Z",
		domain: "competitor.fr",
		volume: 25,
		totalVolume: 100,
	},
	{
		createdAt: "2026-08-28T09:00:00Z",
		domain: "client.fr",
		volume: 50,
		totalVolume: 125,
	},
	{
		createdAt: "2026-08-28T09:00:00Z",
		domain: "competitor.fr",
		volume: 25,
		totalVolume: 125,
	},
];

describe("share of voice snapshot", () => {
	test("counts analyses instead of domain rows", () => {
		expect(countShareOfVoiceAnalyses(data)).toBe(2);
	});

	test("returns the latest share for selected domains in selection order", () => {
		expect(
			getShareOfVoiceSnapshot({
				data,
				selectedDomains: ["competitor.fr", "client.fr", "competitor.fr"],
			}),
		).toEqual([
			{ domain: "competitor.fr", share: 0.2 },
			{ domain: "client.fr", share: 0.4 },
		]);
	});

	test("keeps a selected domain with no result at zero", () => {
		expect(
			getShareOfVoiceSnapshot({
				data: data.slice(0, 2),
				selectedDomains: ["client.fr", "missing.fr"],
			}),
		).toEqual([
			{ domain: "client.fr", share: 0.4 },
			{ domain: "missing.fr", share: 0 },
		]);
	});
});

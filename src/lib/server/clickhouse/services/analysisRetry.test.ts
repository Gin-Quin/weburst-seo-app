import { expect, test } from "bun:test";
import { getRetryRequest, shouldRetryKeyword } from "./analysisRetry";
import type { DataForSeo } from "./DataForSeo";

test("permits two retries for partial results only", () => {
	expect([0, 1, 2, 3].map((attempt) => shouldRetryKeyword(40106, attempt))).toEqual([
		true,
		true,
		false,
		false,
	]);
	for (const code of [20000, 40100, 40200, 40501]) expect(shouldRetryKeyword(code, 0)).toBe(false);
});

test("reuses targeting without copying callback URLs or provider-only fields", () => {
	const data = {
		keyword: "grammar tools",
		location_code: 2250,
		language_code: "fr",
		depth: 50,
		priority: 2,
		device: "desktop",
		os: "windows",
		postback_url: "secret",
		postback_data: "regular",
		api: "serp",
		function: "task_post",
		tag: "old",
	} as DataForSeo.Serp.Data;
	expect(getRetryRequest(data, "analysis")).toEqual({
		keyword: "grammar tools",
		location_code: 2250,
		language_code: "fr",
		depth: 50,
		priority: 2,
		device: "desktop",
		os: "windows",
		tag: "analysis",
	});
});

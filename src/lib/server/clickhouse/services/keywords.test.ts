import { expect, test } from "bun:test";
import { KeywordsService, type KeywordTuple } from "./keywords";

test("KeywordsService: list sets, add, then retrieve for same project", async () => {
	const projectId = `keywords-test-${Date.now()}`;
	const sample: Array<KeywordTuple> = [
		["keyword1", 100],
		["keyword2", 200],
		["keyword3", 300],
	];

	// 1) get keyword sets without failing
	const sets = await KeywordsService.getKeywordSets(projectId);
	expect(Array.isArray(sets)).toBe(true);

	// 2) insert some data without failing
	await KeywordsService.addKeywords(projectId, sample);

	// 3) retrieve the same data later on for the same project id
	// ClickHouse may insert asynchronously; wait briefly until data is visible
	const expectedCount = sample.length;
	const expectedVolumes = sample.map(([, v]) => v).sort((a, b) => a - b);
	const expectedNames = sample.map(([n]) => n).sort();

	let data: Array<{ volume: number; [k: string]: unknown }> | null = null;
	const deadline = Date.now() + 5000;
	while (Date.now() < deadline) {
		try {
			const d = await KeywordsService.getKeywords({ projectId });
			if (Array.isArray(d) && d.length >= expectedCount) {
				data = d as any;
				break;
			}
		} catch {}
		await Bun.sleep(150);
	}

	expect(Array.isArray(data)).toBe(true);
	expect(data!.length).toBeGreaterThanOrEqual(expectedCount);
	const volumes = data!.map((k) => k.volume).sort((a, b) => a - b);
	expect(volumes.slice(0, expectedCount)).toEqual(expectedVolumes);

	const names = (data as any[])
		.map((k) => k.name ?? k.keyword)
		.slice(0, expectedCount)
		.sort();
	expect(names).toEqual(expectedNames);
});

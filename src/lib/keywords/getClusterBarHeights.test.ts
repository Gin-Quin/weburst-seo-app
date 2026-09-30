import { expect, test } from "bun:test";
import { getClusterBarHeights } from "./getClusterBarHeights";

test("keeps a dominant company inside a small cluster", () => {
	const large = getClusterBarHeights({ totalVolume: 1000, clientShare: 20, comparisonShare: 30 }, 1000, 200);
	const small = getClusterBarHeights({ totalVolume: 100, clientShare: 80, comparisonShare: 20 }, 1000, 200);
	expect(large).toEqual({ cluster: 200, client: 40, comparison: 60 });
	expect(small).toEqual({ cluster: 20, client: 16, comparison: 4 });
	expect(small.client).toBeLessThan(large.client);
});

test("represents 100 percent as the full height of each cluster", () => {
	for (const totalVolume of [0, 10, 100, 1000]) {
		const heights = getClusterBarHeights({ totalVolume, clientShare: 100, comparisonShare: 0 }, 1000, 200);
		expect(heights.client).toBe(heights.cluster);
		expect(heights.comparison).toBe(0);
	}
});

test("handles an empty chart and bounds out-of-range shares", () => {
	expect(getClusterBarHeights({ totalVolume: 0, clientShare: 0, comparisonShare: 0 }, 0, 200))
		.toEqual({ cluster: 0, client: 0, comparison: 0 });
	expect(getClusterBarHeights({ totalVolume: 100, clientShare: 101, comparisonShare: -1 }, 100, 200))
		.toEqual({ cluster: 200, client: 200, comparison: 0 });
});

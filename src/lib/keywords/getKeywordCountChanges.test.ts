import { expect, test } from "bun:test";
import { getKeywordCountChanges } from "./getKeywordCountChanges";

test("reports absolute gains, losses, newly ranked and disappeared domains", () => {
	expect(getKeywordCountChanges([
		{ domain: "client", topTenKeywordCount: 8, topThreeKeywordCount: 1 },
		{ domain: "new", topTenKeywordCount: 2, topThreeKeywordCount: 0 },
	], [
		{ domain: "client", topTenKeywordCount: 5, topThreeKeywordCount: 2 },
		{ domain: "lost", topTenKeywordCount: 3, topThreeKeywordCount: 1 },
	])).toEqual({ client: { positioned: 3, topThree: -1 }, new: { positioned: 2, topThree: 0 }, lost: { positioned: -3, topThree: -1 } });
});

test("matches a domain across analyses whether or not it has www.", () => {
	expect(getKeywordCountChanges(
		[{ domain: "site.fr", topTenKeywordCount: 37, topThreeKeywordCount: 11 }],
		[{ domain: "www.site.fr", topTenKeywordCount: 104, topThreeKeywordCount: 33 }],
	)).toEqual({ "site.fr": { positioned: -67, topThree: -22 } });
});

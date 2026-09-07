import { expect, test } from "bun:test";
import { getKeywordCountChanges } from "./getKeywordCountChanges";

test("reports absolute gains, losses, newly ranked and disappeared domains", () => {
	expect(getKeywordCountChanges([
		{ domain: "client", positionnedKeywordCount: 8, topThreeKeywordCount: 1 },
		{ domain: "new", positionnedKeywordCount: 2, topThreeKeywordCount: 0 },
	], [
		{ domain: "client", positionnedKeywordCount: 5, topThreeKeywordCount: 2 },
		{ domain: "lost", positionnedKeywordCount: 3, topThreeKeywordCount: 1 },
	])).toEqual({ client: { positioned: 3, topThree: -1 }, new: { positioned: 2, topThree: 0 }, lost: { positioned: -3, topThree: -1 } });
});

import { describe, expect, test } from "bun:test";
import { getDefaultVisibleDomains } from "./getDefaultVisibleDomains";

describe("getDefaultVisibleDomains", () => {
	test("selects the five highest-ranked domains by default", () => {
		expect(
			getDefaultVisibleDomains(
				["first.test", "second.test", "client.test", "fourth.test", "fifth.test", "sixth.test"],
				"client.test",
			),
		).toEqual(["client.test", "first.test", "second.test", "fourth.test", "fifth.test"]);
	});

	test("keeps the client visible when it is outside the first five domains", () => {
		expect(
			getDefaultVisibleDomains(
				["first.test", "second.test", "third.test", "fourth.test", "fifth.test", "client.test"],
				"client.test",
			),
		).toEqual([
			"client.test",
			"first.test",
			"second.test",
			"third.test",
			"fourth.test",
			"fifth.test",
		]);
	});
});

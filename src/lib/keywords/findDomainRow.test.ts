import { describe, expect, test } from "bun:test";
import { findDomainRow } from "./findDomainRow";

describe("findDomainRow", () => {
	test("matches a stored www domain to the normalized project domain", () => {
		const rows = [{ domain: "www.gallimard-jeunesse.fr", volume: 3410 }];
		expect(findDomainRow(rows, "gallimard-jeunesse.fr")).toBe(rows[0]);
	});

	test("prefers an exact match when both host forms are present", () => {
		const rows = [
			{ domain: "www.example.fr", volume: 3 },
			{ domain: "example.fr", volume: 4 },
		];
		expect(findDomainRow(rows, "example.fr")).toBe(rows[1]);
	});
});

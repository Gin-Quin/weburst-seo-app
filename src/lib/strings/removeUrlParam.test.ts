import { describe, expect, test } from "bun:test";
import { removeUrlParam } from "./removeUrlParam";

describe("removeUrlParam", () => {
	test("removes single srsltid parameter", () => {
		const url = "https://example.com/page?srsltid=abc123&other=value";
		const result = removeUrlParam(url, "srsltid");
		expect(result).toBe("https://example.com/page?other=value");
	});

	test("removes srsltid when it's the only parameter", () => {
		const url = "https://example.com/page?srsltid=xyz789";
		const result = removeUrlParam(url, "srsltid");
		expect(result).toBe("https://example.com/page");
	});

	test("removes srsltid with complex value", () => {
		const url = "https://example.com/?srsltid=AfmBOoqK8vN2PxL-Ym9Zw3Rt&page=1";
		const result = removeUrlParam(url, "srsltid");
		expect(result).toBe("https://example.com/?page=1");
	});

	test("handles URL without srsltid parameter", () => {
		const url = "https://example.com/page?foo=bar&baz=qux";
		const result = removeUrlParam(url, "srsltid");
		expect(result).toBe("https://example.com/page?foo=bar&baz=qux");
	});

	test("removes single parameter by name", () => {
		const url = "https://example.com/page?foo=bar&baz=qux";
		const result = removeUrlParam(url, "foo");
		expect(result).toBe("https://example.com/page?baz=qux");
	});

	test("removes multiple parameters including srsltid", () => {
		const url = "https://example.com/?srsltid=abc123&utm_source=google&page=1&utm_campaign=test";
		const result = removeUrlParam(url, ["srsltid", "utm_source", "utm_campaign"]);
		expect(result).toBe("https://example.com/?page=1");
	});

	test("removes all parameters when array contains all param names", () => {
		const url = "https://example.com/page?srsltid=xyz&foo=bar";
		const result = removeUrlParam(url, ["srsltid", "foo"]);
		expect(result).toBe("https://example.com/page");
	});

	test("preserves URL structure with hash and srsltid removal", () => {
		const url = "https://example.com/page?srsltid=test#section";
		const result = removeUrlParam(url, "srsltid");
		expect(result).toBe("https://example.com/page#section");
	});

	test("handles empty parameter array", () => {
		const url = "https://example.com/page?srsltid=abc&foo=bar";
		const result = removeUrlParam(url, []);
		expect(result).toBe("https://example.com/page?srsltid=abc&foo=bar");
	});

	test("removes srsltid from URL with port", () => {
		const url = "https://example.com:8080/page?srsltid=test123&id=5";
		const result = removeUrlParam(url, "srsltid");
		expect(result).toBe("https://example.com:8080/page?id=5");
	});

	test("handles multiple occurrences of srsltid (edge case)", () => {
		// URL constructor normalizes duplicate params, but testing the behavior
		const url = "https://example.com/?srsltid=first&foo=bar&srsltid=second";
		const result = removeUrlParam(url, "srsltid");
		expect(result).not.toContain("srsltid");
	});
});

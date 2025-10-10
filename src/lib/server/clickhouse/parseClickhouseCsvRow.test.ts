import { describe, expect, test } from "bun:test";
import { parseClickhouseCsvRow } from "./parseClickhouseCsvRow";

describe("parseClickhouseCsvRow", () => {
	test("parses single string column", () => {
		const result = parseClickhouseCsvRow('"hello"', { name: "string" });
		expect(result).toEqual({ name: "hello" });
	});

	test("parses nullable values", () => {
		const result = parseClickhouseCsvRow('"hello", null, 12, null, true, null', {
			name: "string?",
			nameNull: "string?",
			number: "number?",
			numberNull: "number?",
			boolean: "boolean?",
			booleanNull: "boolean?",
		});
		expect(result).toEqual({
			name: "hello",
			nameNull: undefined,
			number: 12,
			numberNull: undefined,
			boolean: true,
			booleanNull: undefined,
		});
	});

	test("parses single number column", () => {
		const result = parseClickhouseCsvRow("42", { count: "number" });
		expect(result).toEqual({ count: 42 });
	});

	test("parses single boolean column (true)", () => {
		const result = parseClickhouseCsvRow("true", { active: "boolean" });
		expect(result).toEqual({ active: true });
	});

	test("parses single boolean column (false)", () => {
		const result = parseClickhouseCsvRow("false", { active: "boolean" });
		expect(result).toEqual({ active: false });
	});

	test("parses mixed columns with string, number, and boolean", () => {
		const result = parseClickhouseCsvRow('"John Doe",25,true', {
			name: "string",
			age: "number",
			active: "boolean",
		});
		expect(result).toEqual({ name: "John Doe", age: 25, active: true });
	});

	test("handles string with escaped quotes", () => {
		const result = parseClickhouseCsvRow('"He said ""hello"""', { message: "string" });
		expect(result).toEqual({ message: 'He said ""hello""' });
	});

	test("handles empty string", () => {
		const result = parseClickhouseCsvRow('""', { text: "string" });
		expect(result).toEqual({ text: "" });
	});

	test("handles float numbers", () => {
		const result = parseClickhouseCsvRow("3.84651", { pi: "number" });
		expect(result).toEqual({ pi: 3.84651 });
	});

	test("handles negative numbers", () => {
		const result = parseClickhouseCsvRow("-42", { temp: "number" });
		expect(result).toEqual({ temp: -42 });
	});

	test("handles spaces between values", () => {
		const result = parseClickhouseCsvRow(' "test", 123, false', {
			name: "string",
			num: "number",
			flag: "boolean",
		});
		expect(result).toEqual({ name: "test", num: 123, flag: false });
	});

	test("parses complex row with multiple columns", () => {
		const result = parseClickhouseCsvRow('"product name",99.99,true,"description text",0,false', {
			name: "string",
			price: "number",
			inStock: "boolean",
			description: "string",
			quantity: "number",
			featured: "boolean",
		});
		expect(result).toEqual({
			name: "product name",
			price: 99.99,
			inStock: true,
			description: "description text",
			quantity: 0,
			featured: false,
		});
	});

	test("throws error when string doesn't start with quote", () => {
		expect(() => {
			parseClickhouseCsvRow("hello", { name: "string" });
		}).toThrow("Expected string value to start with '\"'");
	});

	test("throws error when string doesn't end with quote", () => {
		expect(() => {
			parseClickhouseCsvRow('"hello', { name: "string" });
		}).toThrow("Expected string value to end with '\"'");
	});

	test("handles zero as number", () => {
		const result = parseClickhouseCsvRow("0", { count: "number" });
		expect(result).toEqual({ count: 0 });
	});

	test("handles string with commas inside quotes", () => {
		const result = parseClickhouseCsvRow('"last, first"', { name: "string" });
		expect(result).toEqual({ name: "last, first" });
	});

	test("parses scientific notation numbers", () => {
		const result = parseClickhouseCsvRow("1.5e10", { large: "number" });
		expect(result).toEqual({ large: 1.5e10 });
	});
});

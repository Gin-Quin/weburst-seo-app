import { expect, test } from "bun:test";
import { wrapSvgLabel } from "./wrapSvgLabel";

test("keeps short SVG labels on one line", () => {
	expect(wrapSvgLabel("smartof.tech")).toEqual(["smartof.tech"]);
});

test("wraps SVG labels on a nearby separator", () => {
	expect(wrapSvgLabel("www.bsb-education.com")).toEqual([
		"www.bsb-",
		"education.com",
	]);
});

test("hard-wraps and truncates long SVG labels to two lines", () => {
	expect(wrapSvgLabel("francecompetences-international.fr")).toEqual([
		"francecompeten",
		"ces-internati…",
	]);
});

import { describe, expect, test } from "bun:test";
import { chartColors, getChartColor } from "./chartColors";

describe("getChartColor", () => {
	test("returns chart colors in palette order", () => {
		expect(getChartColor(0)).toBe("var(--color-chart-red)");
		expect(getChartColor(1)).toBe("var(--color-chart-orange)");
	});

	test("cycles through the shared palette", () => {
		expect(getChartColor(chartColors.length)).toBe(chartColors[0]);
	});
});

import { expect, test } from "bun:test";
import { formatTrendPeriod } from "./formatTrendPeriod";

test("formats the actual comparison period in the interface language", () => {
	expect(formatTrendPeriod(35, "fr-FR")).toBe("sur les 35 derniers jours");
	expect(formatTrendPeriod(91, "en")).toBe("over the last 91 days");
	expect(formatTrendPeriod(undefined, "fr")).toBeUndefined();
});

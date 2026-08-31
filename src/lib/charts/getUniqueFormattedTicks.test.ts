import { describe, expect, test } from "bun:test";
import { getUniqueFormattedTicks } from "./getUniqueFormattedTicks";

describe("getUniqueFormattedTicks", () => {
	test("keeps only one tick for each rendered label", () => {
		const ticks = [
			new Date("2026-08-28T12:00:00Z"),
			new Date("2026-08-29T00:00:00Z"),
			new Date("2026-08-29T12:00:00Z"),
			new Date("2026-08-30T00:00:00Z"),
			new Date("2026-08-30T12:00:00Z"),
			new Date("2026-08-31T00:00:00Z"),
		];
		const scale = {
			range: () => [0, 480],
			ticks: () => ticks,
		};

		const result = getUniqueFormattedTicks(scale, (date) =>
			date.toISOString().slice(0, 10),
		);

		expect(result).toEqual([ticks[0]!, ticks[1]!, ticks[3]!, ticks[5]!]);
	});

	test("keeps the axis tick density responsive", () => {
		let requestedCount: number | undefined;
		const scale = {
			range: () => [20, 500],
			ticks: (count?: number) => {
				requestedCount = count;
				return ["28 août", "29 août"];
			},
		};

		getUniqueFormattedTicks(scale, (tick) => tick);

		expect(requestedCount).toBe(6);
	});
});

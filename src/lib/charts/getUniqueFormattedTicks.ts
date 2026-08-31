type TickScale<T> = {
	range: () => unknown[];
	ticks?: (count?: number) => T[];
};

/**
 * Generates responsive ticks and removes values that would render the same label.
 */
export function getUniqueFormattedTicks<T>(
	scale: TickScale<T>,
	format: (tick: T) => string,
	tickSpacing = 80,
): T[] {
	if (!scale.ticks) return [];

	const range = scale.range();
	const start = range.find((value): value is number => typeof value === "number");
	const end = range.findLast(
		(value): value is number => typeof value === "number",
	);
	const width = start === undefined || end === undefined ? 0 : Math.abs(end - start);
	const count = width > 0 ? Math.max(1, Math.round(width / tickSpacing)) : undefined;
	const labels = new Set<string>();

	return scale.ticks(count).filter((tick) => {
		const label = format(tick);
		if (labels.has(label)) return false;

		labels.add(label);
		return true;
	});
}

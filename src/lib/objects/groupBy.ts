export function groupBy<T extends Record<string, any>, K extends keyof T>(
	array: T[],
	key: K,
): Record<T[K] & (string | number | symbol), Omit<T, K>[]> {
	return array.reduce(
		(groups, item) => {
			const groupKey = item[key] as T[K] & (string | number | symbol);
			const { [key]: _, ...rest } = item; // remove the grouping field
			(groups[groupKey] ||= []).push(rest);
			return groups;
		},
		{} as Record<T[K] & (string | number | symbol), Omit<T, K>[]>,
	);
}

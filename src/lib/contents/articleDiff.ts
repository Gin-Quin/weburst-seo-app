export type DiffState = "unchanged" | "added" | "removed";

export type SideBySideDiff = {
	before: DiffState[];
	after: DiffState[];
};

export function diffSequence<T>(before: T[], after: T[]): SideBySideDiff {
	const rows = before.length + 1;
	const columns = after.length + 1;
	const longestCommonSubsequence = Array.from({ length: rows }, () => new Uint16Array(columns));

	for (let beforeIndex = before.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
		for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
			longestCommonSubsequence[beforeIndex]![afterIndex] = Object.is(
				before[beforeIndex],
				after[afterIndex],
			)
				? longestCommonSubsequence[beforeIndex + 1]![afterIndex + 1]! + 1
				: Math.max(
						longestCommonSubsequence[beforeIndex + 1]![afterIndex]!,
						longestCommonSubsequence[beforeIndex]![afterIndex + 1]!,
					);
		}
	}

	const beforeStates: DiffState[] = before.map(() => "removed");
	const afterStates: DiffState[] = after.map(() => "added");
	let beforeIndex = 0;
	let afterIndex = 0;

	while (beforeIndex < before.length && afterIndex < after.length) {
		if (Object.is(before[beforeIndex], after[afterIndex])) {
			beforeStates[beforeIndex] = "unchanged";
			afterStates[afterIndex] = "unchanged";
			beforeIndex += 1;
			afterIndex += 1;
		} else if (
			longestCommonSubsequence[beforeIndex + 1]![afterIndex]! >=
			longestCommonSubsequence[beforeIndex]![afterIndex + 1]!
		) {
			beforeIndex += 1;
		} else {
			afterIndex += 1;
		}
	}

	return { before: beforeStates, after: afterStates };
}

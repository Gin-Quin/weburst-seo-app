export type DiffState = "unchanged" | "added" | "removed";

export type SideBySideDiff = {
	before: DiffState[];
	after: DiffState[];
};

export type TextDiffSegment = {
	value: string;
	state: DiffState;
};

export type SideBySideTextDiff = {
	before: TextDiffSegment[];
	after: TextDiffSegment[];
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

/**
 * Computes a word-level text diff while keeping whitespace and punctuation intact.
 * The returned segments can therefore be joined to recreate each original string.
 */
export function diffText(before: string, after: string): SideBySideTextDiff {
	const beforeTokens = tokenizeText(before);
	const afterTokens = tokenizeText(after);
	const states = diffSequence(beforeTokens, afterTokens);

	return {
		before: mergeAdjacentSegments(beforeTokens, states.before),
		after: mergeAdjacentSegments(afterTokens, states.after),
	};
}

function tokenizeText(value: string) {
	return value.match(/\s+|[\p{L}\p{N}_]+(?:['’][\p{L}\p{N}_]+)*|[^\s\p{L}\p{N}_]+/gu) ?? [];
}

function mergeAdjacentSegments(tokens: string[], states: DiffState[]) {
	return tokens.reduce<TextDiffSegment[]>((segments, value, index) => {
		const state = states[index]!;
		const previous = segments.at(-1);

		if (previous?.state === state) previous.value += value;
		else segments.push({ value, state });

		return segments;
	}, []);
}

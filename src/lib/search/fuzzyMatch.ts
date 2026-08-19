function normalize(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase()
		.trim();
}

export function fuzzyMatch(query: string, values: Array<string | null | undefined>): boolean {
	const needle = normalize(query);
	if (!needle) return true;

	return values.some((value) => {
		const haystack = normalize(value ?? "");
		if (haystack.includes(needle)) return true;

		let needleIndex = 0;
		let previousMatch = -1;
		let totalGap = 0;

		for (let index = 0; index < haystack.length && needleIndex < needle.length; index += 1) {
			if (haystack[index] !== needle[needleIndex]) continue;
			if (previousMatch >= 0) totalGap += index - previousMatch - 1;
			previousMatch = index;
			needleIndex += 1;
		}

		return needleIndex === needle.length && totalGap <= Math.max(4, needle.length * 2);
	});
}

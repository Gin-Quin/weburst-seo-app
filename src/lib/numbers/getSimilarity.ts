export function getSimilarity<T>(list1: Set<T>, list2: Set<T>): number {
	if (list1.size === 0 || list2.size === 0) {
		return 0;
	}

	let intersectionSize = 0;
	for (const item of list1) {
		if (list2.has(item)) intersectionSize += 1;
	}

	return (2 * intersectionSize) / (list1.size + list2.size);
}

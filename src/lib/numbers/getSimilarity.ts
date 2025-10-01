export function getSimilarity<T>(list1: Set<T>, list2: Set<T>): number {
	if (list1.size === 0 || list2.size === 0) {
		return 0;
	}

	return list1.intersection(list2).size / Math.min(list1.size, list2.size);
}

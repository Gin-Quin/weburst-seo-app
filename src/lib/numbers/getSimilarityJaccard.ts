export function getSimilarityJaccard<T>(list1: T[], list2: T[]): number {
	if (list1.length === 0 || list2.length === 0) {
		return 0.0;
	}

	let intersection = 0;

	// Count intersection by iterating over the smaller list
	const [smaller, larger] = list1.length < list2.length ? [list1, list2] : [list2, list1];
	for (const item of smaller) {
		if (larger.includes(item)) {
			intersection++;
		}
	}

	// Union size can be computed without constructing a new Set
	const union = list1.length + list2.length - intersection;

	return intersection / union;
}

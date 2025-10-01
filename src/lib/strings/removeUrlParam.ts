export function removeUrlParam(url: string, param: string | Array<string>): string {
	const urlObj = new URL(url);

	if (Array.isArray(param)) {
		for (const p of param) {
			urlObj.searchParams.delete(p);
		}
	} else {
		urlObj.searchParams.delete(param);
	}

	return urlObj.toString();
}

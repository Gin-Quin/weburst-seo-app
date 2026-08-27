export function isSafeRedirectUri(value: string): boolean {
	try {
		const url = new URL(value);
		if (url.hash || url.username || url.password) return false;
		if (url.protocol === "https:") return true;
		return (
			url.protocol === "http:" &&
			(url.hostname === "127.0.0.1" ||
				url.hostname === "localhost" ||
				url.hostname === "[::1]" ||
				url.hostname === "::1")
		);
	} catch {
		return false;
	}
}

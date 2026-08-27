const encoder = new TextEncoder();

export function generateMcpSecret(prefix: string, byteLength = 32): string {
	const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
	return `${prefix}${toBase64Url(bytes)}`;
}

export async function hashMcpSecret(value: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyPkceChallenge(
	verifier: string,
	expectedChallenge: string,
): Promise<boolean> {
	if (verifier.length < 43 || verifier.length > 128) return false;
	const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
	return toBase64Url(new Uint8Array(digest)) === expectedChallenge;
}

export function getSecretPrefix(secret: string): string {
	return secret.slice(0, 18);
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

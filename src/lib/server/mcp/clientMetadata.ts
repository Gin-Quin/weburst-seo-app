import type { LookupAddress } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const CLIENT_METADATA_TIMEOUT_MS = 5_000;
const MAX_CLIENT_METADATA_BYTES = 32_000;

export type OauthClientMetadata = {
	displayName: string;
	redirectUris: string[];
};

export class ClientMetadataError extends Error {
	constructor() {
		super("invalid_client_metadata_document");
		this.name = "ClientMetadataError";
	}
}

export function isClientMetadataDocumentId(clientId: string): boolean {
	try {
		const url = new URL(clientId);
		return (
			url.protocol === "https:" &&
			!!url.pathname &&
			url.pathname !== "/" &&
			!url.username &&
			!url.password &&
			!url.hash
		);
	} catch {
		return false;
	}
}

export async function resolveClientMetadataDocument(
	clientId: string,
	redirectUri: string,
): Promise<OauthClientMetadata> {
	if (!isClientMetadataDocumentId(clientId)) throw new ClientMetadataError();
	const url = new URL(clientId);
	await assertPublicMetadataDestination(url);

	let response: Response;
	try {
		response = await fetch(url, {
			redirect: "error",
			signal: AbortSignal.timeout(CLIENT_METADATA_TIMEOUT_MS),
			headers: {
				Accept: "application/json",
				"User-Agent": "WeBurst-OAuth/1.0",
			},
		});
	} catch {
		throw new ClientMetadataError();
	}

	if (!response.ok) throw new ClientMetadataError();
	const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
	if (!contentType.includes("application/json")) throw new ClientMetadataError();

	return validateClientMetadataDocument(clientId, redirectUri, await readLimitedJson(response));
}

export function validateClientMetadataDocument(
	clientId: string,
	redirectUri: string,
	payload: unknown,
): OauthClientMetadata {
	if (!isRecord(payload) || payload.client_id !== clientId) throw new ClientMetadataError();
	if (
		typeof payload.client_name !== "string" ||
		!payload.client_name.trim() ||
		payload.client_name.length > 120
	) {
		throw new ClientMetadataError();
	}
	validateTokenEndpointAuthMethods(payload);
	if (!arrayContains(payload.response_types, "code")) throw new ClientMetadataError();
	if (!arrayContains(payload.grant_types, "authorization_code")) {
		throw new ClientMetadataError();
	}

	const redirectUris = validateMetadataRedirectUris(clientId, payload.redirect_uris);
	if (!redirectUris.some((registered) => redirectUriMatches(registered, redirectUri))) {
		throw new ClientMetadataError();
	}

	const clientHost = new URL(clientId).hostname;
	return {
		displayName: `${payload.client_name.trim()} (${clientHost})`,
		redirectUris,
	};
}

function validateMetadataRedirectUris(clientId: string, value: unknown): string[] {
	if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
		throw new ClientMetadataError();
	}
	const clientOrigin = new URL(clientId).origin;
	const redirectUris = [...new Set(value)];
	for (const item of redirectUris) {
		if (typeof item !== "string") throw new ClientMetadataError();
		let redirect: URL;
		try {
			redirect = new URL(item);
		} catch {
			throw new ClientMetadataError();
		}
		const loopback = isLoopbackRedirect(redirect);
		if (
			redirect.hash ||
			redirect.username ||
			redirect.password ||
			(!loopback && (redirect.protocol !== "https:" || redirect.origin !== clientOrigin))
		) {
			throw new ClientMetadataError();
		}
	}
	return redirectUris as string[];
}

function redirectUriMatches(registeredValue: string, requestedValue: string): boolean {
	if (registeredValue === requestedValue) return true;
	try {
		const registered = new URL(registeredValue);
		const requested = new URL(requestedValue);
		if (!isLoopbackRedirect(registered) || !isLoopbackRedirect(requested)) return false;
		return (
			registered.protocol === requested.protocol &&
			registered.hostname === requested.hostname &&
			registered.pathname === requested.pathname &&
			registered.search === requested.search
		);
	} catch {
		return false;
	}
}

function isLoopbackRedirect(url: URL): boolean {
	return (
		url.protocol === "http:" &&
		(url.hostname === "localhost" ||
			url.hostname === "127.0.0.1" ||
			url.hostname === "[::1]" ||
			url.hostname === "::1")
	);
}

async function assertPublicMetadataDestination(url: URL): Promise<void> {
	if (url.port && url.port !== "443") throw new ClientMetadataError();
	let addresses: LookupAddress[];
	try {
		addresses = await lookup(url.hostname, { all: true, verbatim: true });
	} catch {
		throw new ClientMetadataError();
	}
	if (addresses.length === 0 || addresses.some(({ address }) => isPrivateNetworkAddress(address))) {
		throw new ClientMetadataError();
	}
}

function isPrivateNetworkAddress(address: string): boolean {
	if (address.startsWith("[")) address = address.slice(1, -1);
	const version = isIP(address);
	if (version === 4) {
		const [a = 0, b = 0] = address.split(".").map(Number);
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			a >= 224
		);
	}
	if (version === 6) {
		const normalized = address.toLowerCase();
		if (normalized === "::" || normalized === "::1") return true;
		if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
		if (/^fe[89ab]/.test(normalized)) return true;
		const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
		return mappedIpv4 ? isPrivateNetworkAddress(mappedIpv4) : false;
	}
	return true;
}

async function readLimitedJson(response: Response): Promise<unknown> {
	const contentLength = Number(response.headers.get("content-length") || 0);
	if (contentLength > MAX_CLIENT_METADATA_BYTES) throw new ClientMetadataError();
	if (!response.body) throw new ClientMetadataError();

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_CLIENT_METADATA_BYTES) {
			await reader.cancel();
			throw new ClientMetadataError();
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	try {
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		throw new ClientMetadataError();
	}
}

function arrayContains(value: unknown, expected: string): boolean {
	return Array.isArray(value) && value.includes(expected);
}

function validateTokenEndpointAuthMethods(payload: Record<string, unknown>): void {
	const preferred = payload.token_endpoint_auth_method;
	const supported = payload.token_endpoint_auth_methods_supported;

	if (preferred !== undefined && typeof preferred !== "string") {
		throw new ClientMetadataError();
	}

	if (supported === undefined) {
		if (preferred !== undefined && preferred !== "none") throw new ClientMetadataError();
		return;
	}

	if (
		!Array.isArray(supported) ||
		supported.length === 0 ||
		supported.some((method) => typeof method !== "string") ||
		!supported.includes("none") ||
		(preferred !== undefined && !supported.includes(preferred))
	) {
		throw new ClientMetadataError();
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

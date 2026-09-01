import { db } from "$lib/server/db";
import { mcpOauthClients, mcpOauthCodes, mcpTokens, type User } from "$lib/server/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, isNull, lt } from "drizzle-orm";
import {
	ClientMetadataError,
	isClientMetadataDocumentId,
	resolveClientMetadataDocument,
} from "./clientMetadata";
import {
	MCP_CLIENT_METADATA_DOCUMENT_SUPPORTED,
	MCP_SCOPE,
	MCP_SERVER_NAME,
	getMcpServerUrl,
	getPublicBaseUrl,
} from "./config";
import { generateMcpSecret, getSecretPrefix, hashMcpSecret, verifyPkceChallenge } from "./crypto";
import { isSafeRedirectUri } from "./redirect";

const AUTH_CODE_LIFETIME_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_LIFETIME_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000;
const OFFLINE_ACCESS_SCOPE = "offline_access";
const PKCE_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

export type OauthAuthorizationRequest = {
	clientId: string;
	clientName: string;
	redirectUri: string;
	codeChallenge: string;
	scope: string;
	resource: string;
	state: string | null;
};

export function getOauthMetadata(requestUrl?: URL) {
	const baseUrl = getPublicBaseUrl(requestUrl);
	return {
		issuer: baseUrl.origin,
		authorization_response_iss_parameter_supported: true,
		authorization_endpoint: new URL("oauth/authorize", baseUrl).toString(),
		token_endpoint: new URL("oauth/token", baseUrl).toString(),
		registration_endpoint: new URL("oauth/register", baseUrl).toString(),
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		code_challenge_methods_supported: ["S256"],
		token_endpoint_auth_methods_supported: ["none"],
		client_id_metadata_document_supported: MCP_CLIENT_METADATA_DOCUMENT_SUPPORTED,
		scopes_supported: [MCP_SCOPE, OFFLINE_ACCESS_SCOPE],
	};
}

export function getProtectedResourceMetadata(requestUrl?: URL) {
	const baseUrl = getPublicBaseUrl(requestUrl);
	return {
		resource: getMcpServerUrl(requestUrl).toString(),
		authorization_servers: [baseUrl.origin],
		scopes_supported: [MCP_SCOPE],
		resource_name: MCP_SERVER_NAME,
		resource_documentation: new URL("settings/mcp", baseUrl).toString(),
	};
}

export async function registerOauthClient(payload: unknown) {
	if (!isRecord(payload)) throw new OauthRequestError("invalid_client_metadata");
	const redirectUris = validateRedirectUris(payload.redirect_uris);
	const tokenMethod = payload.token_endpoint_auth_method;
	if (tokenMethod !== undefined && tokenMethod !== "none") {
		throw new OauthRequestError("invalid_client_metadata");
	}
	const grantTypes = validateClientGrantTypes(payload.grant_types);
	if (!onlyContains(payload.response_types, "code")) {
		throw new OauthRequestError("invalid_client_metadata");
	}

	const id = `wb_client_${createId()}`;
	const name =
		typeof payload.client_name === "string" && payload.client_name.trim()
			? payload.client_name.trim().slice(0, 120)
			: "MCP client";
	const createdAt = Date.now();
	await db.insert(mcpOauthClients).values({
		id,
		name,
		redirectUrisJson: JSON.stringify(redirectUris),
		createdAt,
	});

	return {
		client_id: id,
		client_id_issued_at: Math.floor(createdAt / 1000),
		client_name: name,
		redirect_uris: redirectUris,
		token_endpoint_auth_method: "none",
		grant_types: grantTypes,
		response_types: ["code"],
	};
}

export async function validateOauthAuthorizationRequest(
	params: URLSearchParams,
	requestUrl?: URL,
): Promise<OauthAuthorizationRequest> {
	if (params.get("response_type") !== "code") {
		throw new OauthRequestError("unsupported_response_type");
	}
	const clientId = requiredParam(params, "client_id");
	const redirectUri = requiredParam(params, "redirect_uri");
	const codeChallenge = requiredParam(params, "code_challenge");
	if (params.get("code_challenge_method") !== "S256" || !PKCE_PATTERN.test(codeChallenge)) {
		throw new OauthRequestError("invalid_request");
	}

	let clientName: string;
	if (isClientMetadataDocumentId(clientId)) {
		try {
			const metadata = await resolveClientMetadataDocument(clientId, redirectUri);
			clientName = metadata.displayName;
			await db
				.insert(mcpOauthClients)
				.values({
					id: clientId,
					name: metadata.displayName,
					redirectUrisJson: JSON.stringify(metadata.redirectUris),
				})
				.onConflictDoUpdate({
					target: mcpOauthClients.id,
					set: {
						name: metadata.displayName,
						redirectUrisJson: JSON.stringify(metadata.redirectUris),
					},
				});
		} catch (error) {
			if (error instanceof ClientMetadataError) throw new OauthRequestError("invalid_client");
			throw error;
		}
	} else {
		const [client] = await db
			.select()
			.from(mcpOauthClients)
			.where(eq(mcpOauthClients.id, clientId))
			.limit(1);
		if (!client) throw new OauthRequestError("invalid_client");
		const redirectUris = parseJsonArray(client.redirectUrisJson);
		if (!redirectUris.includes(redirectUri)) throw new OauthRequestError("invalid_redirect_uri");
		clientName = client.name;
	}

	const scope = normalizeScope(params.get("scope"));
	const resource = params.get("resource") || getMcpServerUrl(requestUrl).toString();
	if (resource !== getMcpServerUrl(requestUrl).toString()) {
		throw new OauthRequestError("invalid_target");
	}
	const state = params.get("state");
	if (state && state.length > 2048) throw new OauthRequestError("invalid_request");

	return {
		clientId,
		clientName,
		redirectUri,
		codeChallenge,
		scope,
		resource,
		state,
	};
}

export async function createOauthAuthorizationRedirect(
	input: OauthAuthorizationRequest,
	user: User,
	requestUrl?: URL,
): Promise<string> {
	const code = generateMcpSecret("wb_code_");
	const now = Date.now();
	await db.delete(mcpOauthCodes).where(lt(mcpOauthCodes.expiresAt, now));
	await db.insert(mcpOauthCodes).values({
		codeHash: await hashMcpSecret(code),
		userId: user.id,
		clientId: input.clientId,
		redirectUri: input.redirectUri,
		codeChallenge: input.codeChallenge,
		scope: input.scope,
		resource: input.resource,
		createdAt: now,
		expiresAt: now + AUTH_CODE_LIFETIME_MS,
	});

	const redirect = new URL(input.redirectUri);
	redirect.searchParams.set("code", code);
	if (input.state) redirect.searchParams.set("state", input.state);
	redirect.searchParams.set("iss", getPublicBaseUrl(requestUrl).origin);
	return redirect.toString();
}

export function createOauthErrorRedirect(
	input: OauthAuthorizationRequest,
	error: string,
	requestUrl?: URL,
): string {
	const redirect = new URL(input.redirectUri);
	redirect.searchParams.set("error", error);
	if (input.state) redirect.searchParams.set("state", input.state);
	redirect.searchParams.set("iss", getPublicBaseUrl(requestUrl).origin);
	return redirect.toString();
}

export async function exchangeOauthToken(params: URLSearchParams, requestUrl?: URL) {
	if (params.get("grant_type") === "refresh_token") {
		return exchangeOauthRefreshToken(params, requestUrl);
	}
	if (params.get("grant_type") !== "authorization_code")
		throw new OauthRequestError("unsupported_grant_type");

	const code = requiredParam(params, "code");
	const clientId = requiredParam(params, "client_id");
	const redirectUri = requiredParam(params, "redirect_uri");
	const verifier = requiredParam(params, "code_verifier");
	const resource = params.get("resource") || getMcpServerUrl(requestUrl).toString();
	const now = Date.now();
	const [grant] = await db
		.select()
		.from(mcpOauthCodes)
		.where(and(eq(mcpOauthCodes.codeHash, await hashMcpSecret(code)), isNull(mcpOauthCodes.usedAt)))
		.limit(1);
	if (
		!grant ||
		grant.expiresAt <= now ||
		grant.clientId !== clientId ||
		grant.redirectUri !== redirectUri ||
		grant.resource !== resource ||
		!(await verifyPkceChallenge(verifier, grant.codeChallenge))
	) {
		throw new OauthRequestError("invalid_grant");
	}

	const accessToken = generateMcpSecret("wb_oauth_");
	const refreshToken = generateMcpSecret("wb_refresh_");
	const expiresAt = now + ACCESS_TOKEN_LIFETIME_MS;
	await db.transaction(async (tx) => {
		const consumed = await tx
			.update(mcpOauthCodes)
			.set({ usedAt: now })
			.where(and(eq(mcpOauthCodes.codeHash, grant.codeHash), isNull(mcpOauthCodes.usedAt)))
			.returning({ codeHash: mcpOauthCodes.codeHash });
		if (consumed.length !== 1) throw new OauthRequestError("invalid_grant");
		await tx.insert(mcpTokens).values({
			id: createId(),
			userId: grant.userId,
			kind: "oauth_access",
			tokenHash: await hashMcpSecret(accessToken),
			prefix: getSecretPrefix(accessToken),
			clientId: grant.clientId,
			scope: grant.scope,
			resource: grant.resource,
			createdAt: now,
			expiresAt,
		});
		await tx.insert(mcpTokens).values({
			id: createId(),
			userId: grant.userId,
			kind: "oauth_refresh",
			tokenHash: await hashMcpSecret(refreshToken),
			prefix: getSecretPrefix(refreshToken),
			clientId: grant.clientId,
			scope: grant.scope,
			resource: grant.resource,
			createdAt: now,
			expiresAt: now + REFRESH_TOKEN_LIFETIME_MS,
		});
	});

	return {
		access_token: accessToken,
		token_type: "Bearer",
		expires_in: Math.floor(ACCESS_TOKEN_LIFETIME_MS / 1000),
		scope: grant.scope,
		refresh_token: refreshToken,
	};
}

async function exchangeOauthRefreshToken(params: URLSearchParams, requestUrl?: URL) {
	const refreshToken = requiredParam(params, "refresh_token");
	const clientId = requiredParam(params, "client_id");
	const resource = params.get("resource") || getMcpServerUrl(requestUrl).toString();
	const now = Date.now();
	const [grant] = await db
		.select()
		.from(mcpTokens)
		.where(
			and(
				eq(mcpTokens.tokenHash, await hashMcpSecret(refreshToken)),
				eq(mcpTokens.kind, "oauth_refresh"),
				isNull(mcpTokens.revokedAt),
			),
		)
		.limit(1);
	if (
		!grant ||
		!grant.expiresAt ||
		grant.expiresAt <= now ||
		grant.clientId !== clientId ||
		grant.resource !== resource
	) {
		throw new OauthRequestError("invalid_grant");
	}

	const scope = normalizeScope(params.get("scope") || grant.scope);
	const grantedScopes = new Set(grant.scope.split(/\s+/));
	if (scope.split(/\s+/).some((value) => !grantedScopes.has(value))) {
		throw new OauthRequestError("invalid_scope");
	}

	const accessToken = generateMcpSecret("wb_oauth_");
	const nextRefreshToken = generateMcpSecret("wb_refresh_");
	await db.transaction(async (tx) => {
		const rotated = await tx
			.update(mcpTokens)
			.set({ revokedAt: now, lastUsedAt: now })
			.where(and(eq(mcpTokens.id, grant.id), isNull(mcpTokens.revokedAt)))
			.returning({ id: mcpTokens.id });
		if (rotated.length !== 1) throw new OauthRequestError("invalid_grant");
		await tx.insert(mcpTokens).values([
			{
				id: createId(),
				userId: grant.userId,
				kind: "oauth_access",
				tokenHash: await hashMcpSecret(accessToken),
				prefix: getSecretPrefix(accessToken),
				clientId,
				scope,
				resource,
				createdAt: now,
				expiresAt: now + ACCESS_TOKEN_LIFETIME_MS,
			},
			{
				id: createId(),
				userId: grant.userId,
				kind: "oauth_refresh",
				tokenHash: await hashMcpSecret(nextRefreshToken),
				prefix: getSecretPrefix(nextRefreshToken),
				clientId,
				scope,
				resource,
				createdAt: now,
				expiresAt: now + REFRESH_TOKEN_LIFETIME_MS,
			},
		]);
	});

	return {
		access_token: accessToken,
		token_type: "Bearer",
		expires_in: Math.floor(ACCESS_TOKEN_LIFETIME_MS / 1000),
		refresh_token: nextRefreshToken,
		scope,
	};
}

export class OauthRequestError extends Error {
	constructor(public readonly code: string) {
		super(code);
	}
}

function validateRedirectUris(value: unknown): string[] {
	if (!Array.isArray(value) || value.length === 0 || value.length > 10) {
		throw new OauthRequestError("invalid_redirect_uri");
	}
	const unique = [...new Set(value)];
	if (unique.some((item) => typeof item !== "string" || !isSafeRedirectUri(item))) {
		throw new OauthRequestError("invalid_redirect_uri");
	}
	return unique as string[];
}

function normalizeScope(value: string | null): string {
	const requested = new Set((value || MCP_SCOPE).split(/\s+/).filter(Boolean));
	if (
		!requested.has(MCP_SCOPE) ||
		[...requested].some((scope) => scope !== MCP_SCOPE && scope !== OFFLINE_ACCESS_SCOPE)
	) {
		throw new OauthRequestError("invalid_scope");
	}
	return [MCP_SCOPE, ...(requested.has(OFFLINE_ACCESS_SCOPE) ? [OFFLINE_ACCESS_SCOPE] : [])].join(
		" ",
	);
}

function requiredParam(params: URLSearchParams, name: string): string {
	const value = params.get(name);
	if (!value) throw new OauthRequestError("invalid_request");
	return value;
}

function onlyContains(value: unknown, expected: string): boolean {
	return (
		value === undefined || (Array.isArray(value) && value.length === 1 && value[0] === expected)
	);
}

function validateClientGrantTypes(value: unknown): string[] {
	if (value === undefined) return ["authorization_code"];
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.length > 2 ||
		!value.includes("authorization_code") ||
		value.some((grant) => grant !== "authorization_code" && grant !== "refresh_token")
	) {
		throw new OauthRequestError("invalid_client_metadata");
	}
	return [...new Set(value)] as string[];
}

function parseJsonArray(value: string): string[] {
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
	} catch {
		return [];
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

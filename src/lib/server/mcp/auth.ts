import { db } from "$lib/server/db";
import { mcpTokens, sessions, users, type McpToken, type User } from "$lib/server/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { MCP_SCOPE } from "./config";
import { generateMcpSecret, getSecretPrefix, hashMcpSecret } from "./crypto";

const API_KEY_PREFIX = "wb_mcp_";
const OAUTH_TOKEN_PREFIX = "wb_oauth_";
const NON_EXPIRING_TOKEN_SECONDS = 253402300799;

export type McpPrincipal = {
	user: User;
	token: McpToken;
};

export type McpApiKeyInfo = {
	hasKey: boolean;
	prefix: string | null;
	createdAt: number | null;
	lastUsedAt: number | null;
};

export async function getMcpApiKeyInfo(userId: string): Promise<McpApiKeyInfo> {
	const [token] = await db
		.select()
		.from(mcpTokens)
		.where(
			and(eq(mcpTokens.userId, userId), eq(mcpTokens.kind, "api_key"), isNull(mcpTokens.revokedAt)),
		)
		.orderBy(desc(mcpTokens.createdAt))
		.limit(1);

	return {
		hasKey: !!token,
		prefix: token?.prefix ?? null,
		createdAt: token?.createdAt ?? null,
		lastUsedAt: token?.lastUsedAt ?? null,
	};
}

export async function rotateMcpApiKey(userId: string): Promise<string> {
	const secret = generateMcpSecret(API_KEY_PREFIX);
	const tokenHash = await hashMcpSecret(secret);
	const now = Date.now();

	await db.transaction(async (tx) => {
		await tx
			.update(mcpTokens)
			.set({ revokedAt: now })
			.where(
				and(
					eq(mcpTokens.userId, userId),
					eq(mcpTokens.kind, "api_key"),
					isNull(mcpTokens.revokedAt),
				),
			);
		await tx.insert(mcpTokens).values({
			id: createId(),
			userId,
			kind: "api_key",
			tokenHash,
			prefix: getSecretPrefix(secret),
			scope: MCP_SCOPE,
			createdAt: now,
		});
	});

	return secret;
}

export async function revokeMcpApiKey(userId: string): Promise<void> {
	await db
		.update(mcpTokens)
		.set({ revokedAt: Date.now() })
		.where(
			and(eq(mcpTokens.userId, userId), eq(mcpTokens.kind, "api_key"), isNull(mcpTokens.revokedAt)),
		);
}

export async function resolveMcpPrincipal(
	secret: string,
	expectedResource?: string,
): Promise<McpPrincipal | null> {
	if (!secret.startsWith(API_KEY_PREFIX) && !secret.startsWith(OAUTH_TOKEN_PREFIX)) return null;
	const now = Date.now();
	const [row] = await db
		.select({ token: mcpTokens, user: users })
		.from(mcpTokens)
		.innerJoin(users, eq(users.id, mcpTokens.userId))
		.where(
			and(
				eq(mcpTokens.tokenHash, await hashMcpSecret(secret)),
				isNull(mcpTokens.revokedAt),
				or(isNull(mcpTokens.expiresAt), gt(mcpTokens.expiresAt, now)),
			),
		)
		.limit(1);

	if (!row) return null;
	if (
		row.token.kind === "oauth_access" &&
		expectedResource &&
		row.token.resource !== expectedResource
	) {
		return null;
	}

	await db.update(mcpTokens).set({ lastUsedAt: now }).where(eq(mcpTokens.id, row.token.id));
	return row;
}

export async function resolveSessionUser(secret: string): Promise<User | null> {
	const [row] = await db
		.select({ session: sessions, user: users })
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(and(eq(sessions.id, secret), gt(sessions.expiresAt, Date.now())))
		.limit(1);
	return row?.user ?? null;
}

export function getMcpTokenExpirySeconds(token: McpToken): number {
	return token.expiresAt ? Math.floor(token.expiresAt / 1000) : NON_EXPIRING_TOKEN_SECONDS;
}

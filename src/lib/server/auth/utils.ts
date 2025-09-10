import { nanoid } from "nanoid";
import { createId } from "@paralleldrive/cuid2";
import { db } from "$lib/server/db";
import { magicLinkTokens, users, oauthAccounts } from "$lib/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { RequestEvent } from "@sveltejs/kit";
import { lucia } from "./lucia";

export function generateId(): string {
	return createId();
}

export function generateToken(): string {
	return nanoid(32);
}

export async function createMagicLinkToken(email: string) {
	const token = generateToken();
	const id = generateId();
	const expiresAt = Date.now() + 1000 * 60 * 15; // 15 minutes

	await db.insert(magicLinkTokens).values({
		id,
		email,
		token,
		expiresAt,
	});

	return token;
}

export async function verifyMagicLinkToken(token: string) {
	const result = await db
		.select()
		.from(magicLinkTokens)
		.where(eq(magicLinkTokens.token, token))
		.limit(1);

	if (result.length === 0) {
		return null;
	}

	const magicLink = result[0];

	if (Date.now() > magicLink.expiresAt) {
		await db
			.delete(magicLinkTokens)
			.where(eq(magicLinkTokens.id, magicLink.id));
		return null;
	}

	return magicLink;
}

export async function createUserFromEmail(
	email: string,
	firstName?: string,
	lastName?: string,
) {
	const userId = generateId();

	await db.insert(users).values({
		id: userId,
		email,
		firstName: firstName || email.split("@")[0],
		lastName: lastName || "",
		role: "manager", // Default role
		emailVerified: true,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	});

	return userId;
}

export async function getUserByEmail(email: string) {
	const result = await db
		.select()
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	return result.length > 0 ? result[0] : null;
}

export async function createSessionAndSetCookie(
	userId: string,
	event: RequestEvent,
) {
	const session = await lucia.createSession(userId, {});
	const sessionCookie = lucia.createSessionCookie(session.id);

	event.cookies.set(sessionCookie.name, sessionCookie.value, {
		path: ".",
		...sessionCookie.attributes,
	});

	return session;
}

export async function invalidateSession(sessionId: string) {
	await lucia.invalidateSession(sessionId);
}

export async function getUserFromOAuth(
	providerId: string,
	providerUserId: string,
) {
	const result = await db
		.select({ user: users })
		.from(oauthAccounts)
		.where(
			and(
				eq(oauthAccounts.providerId, providerId),
				eq(oauthAccounts.providerUserId, providerUserId),
			),
		)
		.innerJoin(users, eq(oauthAccounts.userId, users.id))
		.limit(1);

	return result.length > 0 ? result[0].user : null;
}

export async function createUserFromOAuth(
	providerId: string,
	providerUserId: string,
	email: string,
	firstName: string,
	lastName: string,
) {
	const userId = generateId();

	await db.transaction(async (tx) => {
		await tx.insert(users).values({
			id: userId,
			email,
			firstName,
			lastName,
			role: "manager", // Default role
			emailVerified: true,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		});

		await tx.insert(oauthAccounts).values({
			providerId,
			providerUserId,
			userId,
		});
	});

	return userId;
}

export async function linkOAuthAccount(
	userId: string,
	providerId: string,
	providerUserId: string,
) {
	await db.insert(oauthAccounts).values({
		providerId,
		providerUserId,
		userId,
	});
}

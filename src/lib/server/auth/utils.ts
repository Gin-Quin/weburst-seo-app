import { db } from "$lib/server/db";
import { authenticationTokens, sessions, users, type User } from "$lib/server/db/schema";
import { MINUTE, MONTH } from "$lib/timeUnits";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export function generateToken(): string {
	return nanoid(32);
}

export function generateCode(): string {
	return new Array(6)
		.fill(0)
		.map(() => Math.floor(Math.random() * 10))
		.join("");
}

export async function createAuthenticationCodes(
	email: string,
): Promise<{ magicLinkToken: string; code: string }> {
	const id = createId();
	const code = generateCode();
	const magicLinkToken = generateToken();
	const expiresAt = Date.now() + 15 * MINUTE;

	await db.delete(authenticationTokens).where(eq(authenticationTokens.email, email));

	await db.insert(authenticationTokens).values({
		id,
		email,
		expiresAt,
		code,
		magicLinkToken,
	});

	return { code, magicLinkToken };
}

export async function getUserFromBearerToken(token: string): Promise<User | null> {
	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, token),
	});
	if (!session) {
		console.log(`Session ${token} not found`);
		return null;
	}
	return getUserById(session.userId);
}

export async function createSession(userId: string): Promise<string> {
	const bearer = createId();

	await db.insert(sessions).values({
		id: bearer,
		userId,
		expiresAt: Date.now() + 3 * MONTH,
	});

	return bearer;
}

export async function getBearerTokenFromMagicLinkToken(
	email: string,
	token: string,
): Promise<string | null> {
	const [verification] = await db
		.select()
		.from(authenticationTokens)
		.where(
			and(eq(authenticationTokens.email, email), eq(authenticationTokens.magicLinkToken, token)),
		)
		.limit(1);

	if (!verification) {
		console.log("Verification not found");
		return null;
	}

	if (Date.now() > verification.expiresAt) {
		console.log("Token expired");
		await db.delete(authenticationTokens).where(eq(authenticationTokens.id, verification.id));
		return null;
	}

	const [user] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	if (!user) {
		console.log("User not found");
		return null;
	}

	void db.delete(authenticationTokens).where(eq(authenticationTokens.id, verification.id));

	return await createSession(user.id);
}

export async function getBearerTokenFromCode(email: string, code: string): Promise<string | null> {
	const [verification] = await db
		.select()
		.from(authenticationTokens)
		.where(and(eq(authenticationTokens.email, email)))
		.limit(1);

	if (!verification) {
		console.log("Verification not found");
		return null;
	}

	if (Date.now() > verification.expiresAt || verification.codeAttempts > 5) {
		console.log("Token expired or max attempts reached");
		await db.delete(authenticationTokens).where(eq(authenticationTokens.id, verification.id));
		return null;
	}

	if (code !== verification.code) {
		console.log("Invalid code");
		await db
			.update(authenticationTokens)
			.set({ codeAttempts: verification.codeAttempts + 1 })
			.where(eq(authenticationTokens.id, verification.id));
		return null;
	}

	const [user] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	if (!user) {
		console.log("User not found");
		return null;
	}

	return await createSession(user.id);
}

export async function getUserByEmail(email: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.email, email),
	});
	return user ?? null;
}

export async function getUserById(id: string) {
	const user = await db.query.users.findFirst({
		where: eq(users.id, id),
	});
	if (!user) {
		console.log(`User ${id} not found`);
		return null;
	}
	return user;
}

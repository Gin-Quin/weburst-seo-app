import { command, getRequestEvent, query } from "$app/server";
import {
	createAuthenticationCodes,
	getBearerTokenFromCode,
	getBearerTokenFromMagicLinkToken,
	getUserByEmail,
	getUserById,
} from "$lib/server/auth/utils";
import { db } from "$lib/server/db";
import { sessions, type User } from "$lib/server/db/schema";
import { sendSignInEmail } from "$lib/server/email";
import { eq } from "drizzle-orm";
import * as v from "valibot";

const getRequestBearerToken = (): string | null => {
	const { request } = getRequestEvent();
	return request.headers.get("authorization")?.slice("Bearer ".length) ?? null;
};

const getRequestUserId = async (): Promise<string | null> => {
	const bearerToken = getRequestBearerToken();
	console.log("Getting current user with bearer token:", bearerToken);

	if (!bearerToken) return null;

	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, bearerToken),
	});

	console.log("Found session:", session);

	return session?.userId ?? null;
};

export const getCurrentUser = query(async (): Promise<User | null> => {
	const userId = await getRequestUserId();
	if (!userId) return null;
	return await getUserById(userId);
});

export const clearServerSession = command(async () => {
	const bearerToken = getRequestBearerToken();
	console.log("Getting current user with bearer token:", bearerToken);

	if (!bearerToken) return null;

	await db.delete(sessions).where(eq(sessions.id, bearerToken));
});

export const sendMagicLink = query(
	v.object({
		email: v.string(),
	}),
	async ({ email }): Promise<"success" | "user not found"> => {
		console.log("Sending magic link email:", email);

		// Check if user exists, if not create one
		const user = await getUserByEmail(email);

		console.log("Found user:", user);

		if (!user) {
			return "user not found";
		}

		// Create magic link token
		console.log("Creating magic link token");
		const codes = await createAuthenticationCodes(email);

		// Send magic link email
		console.log("Sending magic link email");
		await sendSignInEmail(email, codes);

		return "success";
	},
);

export const verifyMagicLink = query(
	v.object({ email: v.string(), token: v.string() }),
	async ({ email, token }): Promise<string | null> => {
		return await getBearerTokenFromMagicLinkToken(email, token);
	},
);

export const verifyCode = query(
	v.object({ email: v.string(), code: v.string() }),
	async ({ email, code }): Promise<string | null> => {
		return await getBearerTokenFromCode(email, code);
	},
);

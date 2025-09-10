import {
	createMagicLinkToken,
	createSessionAndSetCookie,
	createUserFromEmail,
	getUserByEmail,
	verifyMagicLinkToken,
} from "$lib/server/auth/utils";
import { sendMagicLinkEmail } from "$lib/server/email";
import * as v from "valibot";
import { command, getRequestEvent, query } from "$app/server";
import { lucia } from "$lib/server/auth/lucia";
import { error, redirect } from "@sveltejs/kit";
import { db } from "$lib/server/db";
import { magicLinkTokens } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

export const logout = command(async () => {
	const { locals, cookies } = getRequestEvent();

	if (!locals.session) {
		redirect(302, "/");
	}

	await lucia.invalidateSession(locals.session.id);
	const sessionCookie = lucia.createBlankSessionCookie();

	cookies.set(sessionCookie.name, sessionCookie.value, {
		path: ".",
		...sessionCookie.attributes,
	});

	redirect(302, "/");
});

export const sendMagicLink = query(
	v.object({
		email: v.string(),
	}),
	async ({ email }): Promise<"success" | "user not found"> => {
		// Check if user exists, if not create one
		let user = await getUserByEmail(email);
		if (!user) {
			return "user not found";
		}

		// Create magic link token
		const token = await createMagicLinkToken(email);

		// Send magic link email
		await sendMagicLinkEmail(email, token);
		return "success";
	},
);

export const verifyMagicLink = command(v.string(), async (token) => {
	const event = getRequestEvent();
	console.log("verifyMagicLink", token);

	if (!token) {
		console.error("Missing token");
		error(400, "Missing token");
	}

	// Verify the magic link token
	const magicLink = await verifyMagicLinkToken(token);

	if (!magicLink) {
		console.error("Invalid or expired token");
		error(400, "Invalid or expired token");
	}

	// Get the user
	const user = await getUserByEmail(magicLink.email);

	if (!user) {
		console.error("User not found");
		error(400, "User not found");
	}

	// Create session
	await createSessionAndSetCookie(user.id, event);

	// Delete the used token
	await db.delete(magicLinkTokens).where(eq(magicLinkTokens.token, token));

	return true;
});

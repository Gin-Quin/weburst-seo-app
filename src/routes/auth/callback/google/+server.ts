import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { google } from "$lib/server/auth/oauth";
import {
	getUserFromOAuth,
	createUserFromOAuth,
	createSessionAndSetCookie
} from "$lib/server/auth/utils";

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const storedState = cookies.get("google_oauth_state");
	const codeVerifier = cookies.get("google_code_verifier");

	if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
		return new Response("Invalid request", { status: 400 });
	}

	try {
		const tokens = await google.validateAuthorizationCode(code, codeVerifier);
		
		// Fetch user info from Google
		const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
			headers: {
				Authorization: `Bearer ${tokens.accessToken}`
			}
		});

		const googleUser = await response.json() as {
			id: string;
			email: string;
			given_name: string;
			family_name: string;
			picture: string;
		};

		// Check if user exists with this Google account
		let user = await getUserFromOAuth("google", googleUser.id);

		if (!user) {
			// Create new user
			const userId = await createUserFromOAuth(
				"google",
				googleUser.id,
				googleUser.email,
				googleUser.given_name || googleUser.email.split("@")[0],
				googleUser.family_name || ""
			);
			user = { id: userId } as any;
		}

		// Create session
		await createSessionAndSetCookie(user.id, { cookies, locals } as any);

		// Clear OAuth cookies
		cookies.delete("google_oauth_state", { path: "/" });
		cookies.delete("google_code_verifier", { path: "/" });

		throw redirect(302, "/dashboard");
	} catch (error) {
		if (error instanceof Response) {
			throw error;
		}
		console.error("Google OAuth error:", error);
		return new Response("Authentication failed", { status: 500 });
	}
};
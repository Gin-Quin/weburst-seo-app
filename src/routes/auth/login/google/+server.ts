import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { google } from "$lib/server/auth/oauth";
import { generateState, generateCodeVerifier } from "arctic";
import { dev } from "$app/environment";

export const GET: RequestHandler = async ({ cookies }) => {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();

	const url = await google.createAuthorizationURL(state, codeVerifier, {
		scopes: ["email", "profile"]
	});

	cookies.set("google_oauth_state", state, {
		path: "/",
		secure: !dev,
		httpOnly: true,
		maxAge: 60 * 10, // 10 minutes
		sameSite: "lax"
	});

	cookies.set("google_code_verifier", codeVerifier, {
		path: "/",
		secure: !dev,
		httpOnly: true,
		maxAge: 60 * 10, // 10 minutes
		sameSite: "lax"
	});

	throw redirect(302, url.toString());
};
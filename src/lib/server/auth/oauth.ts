import { Google } from "arctic";
import { env } from "$env/dynamic/private";

export const google = new Google(
	env.GOOGLE_CLIENT_ID || "",
	env.GOOGLE_CLIENT_SECRET || "",
	`${env.PUBLIC_BASE_URL || "http://localhost:5173"}/auth/callback/google`
);
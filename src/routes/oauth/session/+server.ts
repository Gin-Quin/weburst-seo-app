import { resolveSessionUser } from "$lib/server/mcp/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
	const authorization = request.headers.get("authorization");
	const bearer = authorization?.startsWith("Bearer ")
		? authorization.slice("Bearer ".length).trim()
		: "";
	const user = bearer ? await resolveSessionUser(bearer) : null;

	return new Response(JSON.stringify(user ? { email: user.email } : { error: "unauthorized" }), {
		status: user ? 200 : 401,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
};

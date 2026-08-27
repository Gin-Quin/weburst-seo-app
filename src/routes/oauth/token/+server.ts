import { oauthErrorResponse, jsonResponse } from "$lib/server/mcp/http";
import { OauthRequestError, exchangeOauthToken } from "$lib/server/mcp/oauth";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const response = jsonResponse(
			await exchangeOauthToken(new URLSearchParams(await request.text()), url),
		);
		response.headers.set("Pragma", "no-cache");
		return response;
	} catch (error) {
		return oauthErrorResponse(
			error instanceof OauthRequestError ? error.code : "server_error",
			error instanceof OauthRequestError ? 400 : 500,
		);
	}
};

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		status: 204,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});

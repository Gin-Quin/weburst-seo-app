import { jsonResponse } from "$lib/server/mcp/http";
import { getProtectedResourceMetadata } from "$lib/server/mcp/oauth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) =>
	jsonResponse(getProtectedResourceMetadata(url));
export const OPTIONS: RequestHandler = async () => new Response(null, { status: 204 });

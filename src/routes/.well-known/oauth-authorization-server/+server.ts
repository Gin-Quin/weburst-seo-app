import { jsonResponse } from "$lib/server/mcp/http";
import { getOauthMetadata } from "$lib/server/mcp/oauth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => jsonResponse(getOauthMetadata(url));
export const OPTIONS: RequestHandler = async () => new Response(null, { status: 204 });

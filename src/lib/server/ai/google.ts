import { env } from "$env/dynamic/private";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const GOOGLE_CHAT_MODEL = "gemini-3.8-flash";

export function getGoogleGenerativeAI() {
	const apiKey = env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY;
	if (!apiKey) return null;
	// Only the last 4 chars: enough to tell keys apart without leaking the secret into logs
	console.info(`[google-ai] using api key …${apiKey.slice(-4)}`);
	return createGoogleGenerativeAI({ apiKey });
}

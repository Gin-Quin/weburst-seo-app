import { env } from "$env/dynamic/private";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const GOOGLE_CHAT_MODEL = "gemini-3.7-flash";

export function getGoogleGenerativeAI() {
	const apiKey = env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY;
	return apiKey ? createGoogleGenerativeAI({ apiKey }) : null;
}

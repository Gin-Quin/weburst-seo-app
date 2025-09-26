import { text } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	console.log("POST Received data:", await request.text());
	return text("POST OK");
};

export const OPTIONS: RequestHandler = async ({ request }) => {
	console.log("OPTIONS");
	return text("OPTIONS OK");
};

export const GET: RequestHandler = async ({ request }) => {
	console.log("GET");
	return text("GET OK");
};

export const HEAD: RequestHandler = async ({ request }) => {
	console.log("HEAD");
	return text("HEAD OK");
};

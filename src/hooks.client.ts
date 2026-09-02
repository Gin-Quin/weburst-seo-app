import { createAuthenticatedFetch } from "$lib/auth/authenticatedFetch";
import type { ClientInit } from "@sveltejs/kit";

export const init: ClientInit = () => {
	globalThis.fetch = createAuthenticatedFetch(
		globalThis.fetch,
		() => localStorage.getItem("bearer"),
		window.location.origin,
	);
};

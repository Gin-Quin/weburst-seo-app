import type { HandleFetch } from "@sveltejs/kit";

export const handleFetch: HandleFetch = async ({ request, fetch }) => {
	console.log("Handling fetch request:", request);
	console.log("Localstorage:", localStorage);
	const token = localStorage.getItem("bearer");

	if (token) {
		console.log("Token found:", token);
		request = new Request(request, {
			headers: {
				...Object.fromEntries(request.headers),
				Authorization: `Bearer ${token}`,
			},
		});
	}

	return fetch(request);
};

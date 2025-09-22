import type { HandleFetch } from "@sveltejs/kit";

export const handleFetch: HandleFetch = async ({ request, fetch }) => {
	const token = localStorage.getItem("bearer");

	if (token) {
		request = new Request(request, {
			headers: {
				...Object.fromEntries(request.headers),
				Authorization: `Bearer ${token}`,
			},
		});
	}

	return fetch(request);
};

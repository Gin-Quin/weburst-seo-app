import type { HandleFetch } from "@sveltejs/kit";

const timeUntil23PM = () => {
	const now = new Date();
	const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23);
	return target.getTime() - now.getTime();
};

setTimeout(() => {
	console.log("Hello, world!");
}, timeUntil23PM());

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

import { redirect } from "@sveltejs/kit";

export function load({ url }) {
	redirect(307, `${url.pathname}/share-of-voice`);
}

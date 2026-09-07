import type { ContentStatus } from "$lib/server/db/schema";

export const contentStatusLabels: Record<ContentStatus, string> = {
	new: "Nouveau",
	in_progress: "En cours",
	done: "Fait",
	published: "Publié",
};

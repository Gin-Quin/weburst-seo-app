import type { Role } from "$lib/server/db/schema";
import { defineContent } from "../locale.svelte";

export const userRoles = defineContent<Record<Role, string>>({
	en: {
		admin: "Admin",
		user: "Project Leader",
		project_manager: "Project Manager",
		client: "Client",
	},
	fr: {
		admin: "Admin",
		user: "Chef de projet",
		project_manager: "Chef de projet",
		client: "Client",
	},
});

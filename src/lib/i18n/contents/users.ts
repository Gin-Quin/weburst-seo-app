import type { Role } from "$lib/server/db/schema";
import { defineContent } from "../locale.svelte";

export const userRoles = defineContent<Record<Role, string>>({
	en: {
		admin: "Admin",
		user: "Project Leader",
	},
	fr: {
		admin: "Admin",
		user: "Chef de projet",
	}
})

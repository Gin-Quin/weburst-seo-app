import type { Role } from "$lib/server/db/schema";

export function canManageKeywords(role: Role | null | undefined): boolean {
	return role === "admin" || role === "project_manager";
}

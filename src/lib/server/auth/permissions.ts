import type { Role } from "../db/schema";

export type ClientAction = "view" | "manage";

export function roleCanAccessClient(
	role: Role,
	hasMembership: boolean,
	action: ClientAction,
): boolean {
	if (role === "admin") return true;
	if (!hasMembership) return false;
	if (action === "view") return true;
	return role === "project_manager";
}

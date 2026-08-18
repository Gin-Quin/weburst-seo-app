import type { Role } from "../db/schema";

export type ClientAction = "view" | "manage";

export function roleCanAccessClient(
	role: Role,
	hasMembership: boolean,
	action: ClientAction,
): boolean {
	if (role === "admin") return true;
	if (!hasMembership) return false;
	if (role === "client") return action === "view";
	return role === "project_manager" || role === "user";
}

import type { Role } from "$lib/server/db/schema";

export function canReadMcpClients(role: Role): boolean {
	return role === "admin" || role === "project_manager";
}

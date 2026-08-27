import type { Project, Role } from "$lib/server/db/schema";

export function canViewProjectContents(
	role: Role | undefined,
	projectType: Project["type"] | undefined,
): boolean {
	return role !== "client" || projectType === "monthly_subscription";
}

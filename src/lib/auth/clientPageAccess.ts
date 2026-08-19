type Role = "admin" | "user" | "project_manager" | "client";

export function canAccessClientsArea(role: Role): boolean {
	return role === "admin" || role === "project_manager";
}

export function canAccessClientPage(
	role: Role,
	clientId: string | undefined,
	accessibleClientIds: string[],
): boolean {
	if (!canAccessClientsArea(role)) return false;
	return !clientId || accessibleClientIds.includes(clientId);
}

import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { usersToClients, type Project, type User } from "../db/schema";
import { getProjectById } from "../projects";
import { roleCanAccessClient, type ClientAction } from "./permissions";

export type ProjectAction = "view" | "manage" | "manage_keywords";

export function requireAdmin(user: User | null): asserts user is User {
	if (user?.role !== "admin") throw new Error("Unauthorized");
}

export async function hasClientMembership(userId: string, clientId: string): Promise<boolean> {
	const membership = await db.query.usersToClients.findFirst({
		where: and(eq(usersToClients.userId, userId), eq(usersToClients.clientId, clientId)),
	});
	return membership !== undefined;
}

export async function canAccessClient(
	user: User,
	clientId: string,
	action: ClientAction,
): Promise<boolean> {
	if (user.role === "admin") return true;
	return roleCanAccessClient(user.role, await hasClientMembership(user.id, clientId), action);
}

export async function requireClientAccess(
	user: User | null,
	clientId: string,
	action: ClientAction,
): Promise<void> {
	if (!user || !(await canAccessClient(user, clientId, action))) {
		throw new Error("Unauthorized");
	}
}

export async function canAccessProject(
	user: User,
	project: Project,
	action: ProjectAction,
): Promise<boolean> {
	if (user.role === "admin") return true;
	if (!project.clientId) return false;
	const clientAction: ClientAction = action === "view" ? "view" : "manage";
	return roleCanAccessClient(
		user.role,
		await hasClientMembership(user.id, project.clientId),
		clientAction,
	);
}

export async function requireProjectAccess(
	user: User | null,
	projectId: string,
	action: ProjectAction,
): Promise<Project> {
	if (!user) throw new Error("Unauthorized");
	const project = await getProjectById(projectId);
	if (!project || !(await canAccessProject(user, project, action))) {
		throw new Error("Unauthorized");
	}
	return project;
}

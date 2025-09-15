import { query } from "$app/server";
import { db } from "$lib/server/db";
import { projects, usersToProjects, type Project } from "$lib/server/db/schema";
import {
	createProject as createProjectService,
	deleteProject as deleteProjectService,
	getProjectById as getProjectByIdService,
	updateProject as updateProjectService,
} from "$lib/server/projects";

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
	CreateProject,
	DeleteProject,
	GetProjectById,
	ListProjects,
	UpdateProject,
} from "./projects.schema";
import { getRequestUser, getRequestUserId } from "./utilities";

export const createProject = query(CreateProject, async (input): Promise<Project> => {
	const user = await getRequestUser();
	if (!user) {
		throw new Error("Unauthorized");
	}
	const project = await createProjectService(input);

	await db.insert(usersToProjects).values(
		input.leaderIds.map((leaderId) => ({
			userId: leaderId,
			projectId: project.id,
		})),
	);

	return project;
});

export const getProjectById = query(GetProjectById, async (id): Promise<Project | null> => {
	const userId = await getRequestUserId();
	if (!userId) return null;
	const membership = await db.query.usersToProjects.findFirst({
		where: and(eq(usersToProjects.userId, userId), eq(usersToProjects.projectId, id)),
	});
	if (!membership) return null;
	return await getProjectByIdService(id);
});

export const listProjects = query(ListProjects, async (params = {}): Promise<Project[]> => {
	const user = await getRequestUser();
	if (!user) return [];

	// Determine owner filter: non-admins are restricted to themselves
	const ownerIds = user.role === "admin" ? params.ownerIds : [user.id];

	// Build optional filters
	const conditions = [];
	if (params?.name?.trim().length) {
		const term = `%${params.name.trim().toLowerCase()}%`;
		conditions.push(sql`lower(${projects.clientName}) like ${term}`);
	}
	if (Array.isArray(params?.types) && params.types.length > 0) {
		conditions.push(inArray(projects.type, params.types));
	}

	// If we have an owner filter (non-admin or admin provided owners), join with memberships
	if (ownerIds && ownerIds.length > 0) {
		const rows = await db
			.select({ project: projects, userId: usersToProjects.userId })
			.from(usersToProjects)
			.innerJoin(projects, and(eq(usersToProjects.projectId, projects.id)))
			.where(
				conditions.length > 0
					? and(
							isNotNull(projects.deletedAt),
							inArray(usersToProjects.userId, ownerIds),
							...conditions,
						)
					: and(isNotNull(projects.deletedAt), inArray(usersToProjects.userId, ownerIds)),
			);

		// Deduplicate projects in case of multiple owners/memberships
		const byId = new Map<string, Project>();
		for (const row of rows) {
			byId.set(row.project.id, row.project);
		}
		return Array.from(byId.values());
	}

	// Admin with no owner filter: return all projects with optional filters
	if (conditions.length > 0) {
		const whereCond = conditions.length > 1 ? and(...conditions) : conditions[0]!;
		return await db.select().from(projects).where(whereCond);
	}
	return await db.select().from(projects);
});

export const updateProject = query(
	UpdateProject,
	async ([id, updates]): Promise<Project | null> => {
		const userId = await getRequestUserId();
		if (!userId) return null;
		const membership = await db.query.usersToProjects.findFirst({
			where: and(eq(usersToProjects.userId, userId), eq(usersToProjects.projectId, id)),
		});
		if (!membership) return null;
		return await updateProjectService(id, updates);
	},
);

export const deleteProject = query(DeleteProject, async (id): Promise<Project | null> => {
	const userId = await getRequestUserId();
	if (!userId) return null;
	const membership = await db.query.usersToProjects.findFirst({
		where: and(eq(usersToProjects.userId, userId), eq(usersToProjects.projectId, id)),
	});
	if (!membership) return null;
	return await deleteProjectService(id);
});

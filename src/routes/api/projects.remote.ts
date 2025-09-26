import { command, query } from "$app/server";
import { db } from "$lib/server/db";
import { projects, users, usersToProjects, type Project, type User } from "$lib/server/db/schema";
import {
	createProject as createProjectService,
	deleteProject as deleteProjectService,
	updateProject as updateProjectService,
} from "$lib/server/projects";

import {
	KeywordsService,
	type AggregatedKeywordAnalysis,
} from "$lib/server/clickhouse/services/keywords";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { CreateProject, DeleteProject, UpdateProject } from "./projects.schema";
import { getRequestUser } from "./utilities";

export const createProject = command(CreateProject, async (input): Promise<void> => {
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

	await listProjects().refresh();
});

// export const getProjectById = query(GetProjectById, async (id): Promise<ProjectInfo | null> => {
// 	const userId = await getRequestUserId();
// 	if (!userId) return null;
// 	const membership = await db.query.usersToProjects.findFirst({
// 		where: and(eq(usersToProjects.userId, userId), eq(usersToProjects.projectId, id)),
// 	});
// 	if (!membership) return null;
// 	const project = await getProjectByIdService(id);
// 	if (!project) return null;

// 	const rows = await db
// 		.select({ user: users })
// 		.from(usersToProjects)
// 		.innerJoin(users, eq(usersToProjects.userId, users.id))
// 		.where(eq(usersToProjects.projectId, id));

// 	const leaders = rows.map(({ user }) => ({
// 		id: user.id,
// 		firstName: user.firstName,
// 		lastName: user.lastName,
// 		email: user.email,
// 		role: user.role,
// 	}));

// 	const analysis =

// 	return { ...project, leaders };
// });

export const listProjects = query(async (): Promise<ProjectInfo[]> => {
	const user = await getRequestUser();
	if (!user) return [];

	// Determine owner filter: non-admins are restricted to themselves
	const ownerId = user.role === "admin" ? undefined : user.id;

	// If we have an owner filter (non-admin or admin provided owners), join with memberships
	if (ownerId) {
		const rows = await db
			.select({ project: projects, userId: usersToProjects.userId })
			.from(usersToProjects)
			.where(eq(usersToProjects.userId, ownerId))
			.innerJoin(
				projects,
				and(eq(usersToProjects.projectId, projects.id), isNull(projects.deletedAt)),
			);

		// Deduplicate projects in case of multiple owners/memberships
		const byId = new Map<string, Project>();
		for (const row of rows) {
			byId.set(row.project.id, row.project);
		}
		return await attachProjectInfo(Array.from(byId.values()));
	}

	return await attachProjectInfo(
		await db.select().from(projects).where(isNull(projects.deletedAt)),
	);
});

export const updateProject = command(UpdateProject, async ([id, updates]): Promise<void> => {
	const user = await getRequestUser();
	if (!user) {
		throw new Error("Unauthorized");
	}

	if (user.role !== "admin") {
		const membership = await db.query.usersToProjects.findFirst({
			where: and(eq(usersToProjects.userId, user.id), eq(usersToProjects.projectId, id)),
		});
		if (!membership) {
			throw new Error("You are not a member of this project");
		}
	}

	// Update core project fields
	await updateProjectService(id, updates);

	// Sync leaders if provided
	const leaderIds = (updates as any)?.leaderIds as string[] | undefined;
	if (leaderIds) {
		const existing = await db
			.select({ userId: usersToProjects.userId })
			.from(usersToProjects)
			.where(eq(usersToProjects.projectId, id));
		const existingIds = new Set(existing.map((e) => e.userId));
		const desiredIds = new Set(leaderIds);

		const toAdd: string[] = [];
		for (const uid of desiredIds) {
			if (!existingIds.has(uid)) toAdd.push(uid);
		}
		const toRemove: string[] = [];
		for (const uid of existingIds) {
			if (!desiredIds.has(uid)) toRemove.push(uid);
		}

		if (toRemove.length > 0) {
			await db
				.delete(usersToProjects)
				.where(and(eq(usersToProjects.projectId, id), inArray(usersToProjects.userId, toRemove)));
		}
		if (toAdd.length > 0) {
			await db.insert(usersToProjects).values(
				toAdd.map((userId) => ({
					userId,
					projectId: id,
				})),
			);
		}
	}

	await listProjects().refresh();
});

export const deleteProject = command(DeleteProject, async (id): Promise<void> => {
	const user = await getRequestUser();
	if (!user) {
		throw new Error("Unauthorized");
	}
	if (user.role != "admin") {
		const membership = await db.query.usersToProjects.findFirst({
			where: and(eq(usersToProjects.userId, user.id), eq(usersToProjects.projectId, id)),
		});
		if (!membership) {
			throw new Error("Unauthorized: you're not a member of this project");
		}
	}
	console.log("Deleting project with ID:", id);
	await deleteProjectService(id);
	await listProjects().refresh();
});

export type ProjectInfo = Project & {
	leaders: Pick<User, "id" | "firstName" | "lastName" | "email" | "role">[];
	analysis: AggregatedKeywordAnalysis | null;
};

async function attachProjectInfo(projectList: Project[]): Promise<ProjectInfo[]> {
	if (projectList.length === 0) return [];
	const projectIds = projectList.map((project) => project.id);

	const projectAndUsers = await db
		.select({ user: users, projectId: usersToProjects.projectId })
		.from(usersToProjects)
		.innerJoin(users, eq(usersToProjects.userId, users.id))
		.where(inArray(usersToProjects.projectId, projectIds));

	const leadersByProject = new Map<string, ProjectInfo["leaders"]>();
	for (const { user, projectId } of projectAndUsers) {
		const list = leadersByProject.get(projectId) ?? [];
		list.push({
			id: user.id,
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.email,
			role: user.role,
		});
		leadersByProject.set(projectId, list);
	}

	return await Promise.all(
		projectList.map(async (project) => {
			const leaders = leadersByProject.get(project.id) ?? [];

			const analysis = await KeywordsService.aggregateAnalysisResultsWithTrend({
				projectId: project.id,
			});

			return { ...project, leaders, analysis };
		}),
	);
}

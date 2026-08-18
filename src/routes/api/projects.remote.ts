import { command, query } from "$app/server";
import { requireClientAccess, requireProjectAccess } from "$lib/server/auth/authorization";
import {
	createClient,
	findClientByName,
	getClientById,
	setClientProjectManagers,
	validateProjectManagerIds,
} from "$lib/server/clients";
import {
	KeywordsService,
	type AggregatedKeywordAnalysis,
} from "$lib/server/clickhouse/services/keywords";
import { db } from "$lib/server/db";
import {
	clients,
	projects,
	users,
	usersToClients,
	type Client,
	type Project,
	type User,
} from "$lib/server/db/schema";
import {
	createProject as createProjectService,
	deleteProject as deleteProjectService,
	updateProject as updateProjectService,
} from "$lib/server/projects";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { CreateProject as CreateProjectInput, ProjectUpdate } from "./projects.schema";
import { CreateProject, DeleteProject, UpdateProject } from "./projects.schema";
import { getRequestUser } from "./utilities";

export const createProject = command(CreateProject, async (input): Promise<void> => {
	const user = await getRequestUser();
	if (!user) throw new Error("Unauthorized");

	if (user.role === "admin") {
		await validateProjectManagerIds(input.projectManagerIds ?? input.leaderIds);
	}
	const client = await resolveInputClient(user, input);
	await requireClientAccess(user, client.id, "manage");
	const { leaderIds, projectManagerIds, clientId: _clientId, ...projectInput } = input;
	await createProjectService({
		...projectInput,
		clientId: client.id,
		clientName: client.name,
	});

	if (user.role === "admin") {
		await setClientProjectManagers(client.id, projectManagerIds ?? leaderIds);
	}

	await listProjects().refresh();
});

export const listProjects = query(async (): Promise<ProjectInfo[]> => {
	const user = await getRequestUser();
	if (!user) return [];

	if (user.role === "admin") {
		return attachProjectInfo(
			await db.select().from(projects).where(isNull(projects.deletedAt)),
			true,
		);
	}

	const rows = await db
		.select({ project: projects })
		.from(usersToClients)
		.innerJoin(
			projects,
			and(eq(usersToClients.clientId, projects.clientId), isNull(projects.deletedAt)),
		)
		.where(eq(usersToClients.userId, user.id));
	const projectsById = new Map(rows.map(({ project }) => [project.id, project]));
	return attachProjectInfo([...projectsById.values()], user.role !== "client");
});

export const updateProject = command(UpdateProject, async ([id, input]): Promise<void> => {
	const user = await getRequestUser();
	const existingProject = await requireProjectAccess(user, id, "manage");
	if (user!.role === "admin" && (input.projectManagerIds || input.leaderIds)) {
		await validateProjectManagerIds(input.projectManagerIds ?? input.leaderIds ?? []);
	}
	const client = await resolveInputClient(user!, input, existingProject.clientId);
	await requireClientAccess(user, client.id, "manage");

	if (user!.role !== "admin" && client.id !== existingProject.clientId) {
		throw new Error("Only admins can move a project to another client");
	}

	const { leaderIds, projectManagerIds, clientId: _clientId, ...projectUpdates } = input;
	await updateProjectService(id, {
		...projectUpdates,
		clientId: client.id,
		clientName: client.name,
	});

	if (user!.role === "admin" && (projectManagerIds || leaderIds)) {
		await setClientProjectManagers(client.id, projectManagerIds ?? leaderIds ?? []);
	}

	await listProjects().refresh();
});

export const deleteProject = command(DeleteProject, async (id): Promise<void> => {
	const user = await getRequestUser();
	await requireProjectAccess(user, id, "manage");
	await deleteProjectService(id);
	await listProjects().refresh();
});

export type ProjectInfo = Project & {
	client: Client | null;
	leaders: Pick<User, "id" | "firstName" | "lastName" | "email" | "role">[];
	analysis: AggregatedKeywordAnalysis | null;
};

type ClientInput = Pick<Partial<CreateProjectInput & ProjectUpdate>, "clientId" | "clientName">;

async function resolveInputClient(
	user: User,
	input: ClientInput,
	fallbackClientId?: string | null,
): Promise<Client> {
	if (input.clientId) {
		const client = await getClientById(input.clientId);
		if (!client) throw new Error("Client not found");
		return client;
	}

	if (input.clientName?.trim()) {
		const existingClient = await findClientByName(input.clientName);
		if (existingClient) return existingClient;
		if (user.role !== "admin") throw new Error("Only admins can create clients");
		return createClient({ name: input.clientName.trim() });
	}

	if (fallbackClientId) {
		const client = await getClientById(fallbackClientId);
		if (client) return client;
	}

	throw new Error("A valid client is required");
}

async function attachProjectInfo(
	projectList: Project[],
	includeManagers: boolean,
): Promise<ProjectInfo[]> {
	if (projectList.length === 0) return [];
	const clientIds = [
		...new Set(projectList.map(({ clientId }) => clientId).filter((id): id is string => !!id)),
	];
	const clientList =
		clientIds.length === 0
			? []
			: await db.select().from(clients).where(inArray(clients.id, clientIds));
	const clientsById = new Map(clientList.map((client) => [client.id, client]));
	const managerRows =
		clientIds.length === 0 || !includeManagers
			? []
			: await db
					.select({ user: users, clientId: usersToClients.clientId })
					.from(usersToClients)
					.innerJoin(users, eq(usersToClients.userId, users.id))
					.where(
						and(
							inArray(usersToClients.clientId, clientIds),
							inArray(users.role, ["user", "project_manager"]),
						),
					);
	const managersByClient = new Map<string, ProjectInfo["leaders"]>();
	for (const { user, clientId } of managerRows) {
		const managers = managersByClient.get(clientId) ?? [];
		managers.push({
			id: user.id,
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.email,
			role: user.role,
		});
		managersByClient.set(clientId, managers);
	}

	return Promise.all(
		projectList.map(async (project) => ({
			...project,
			client: project.clientId ? (clientsById.get(project.clientId) ?? null) : null,
			leaders: project.clientId ? (managersByClient.get(project.clientId) ?? []) : [],
			analysis: await KeywordsService.getProjectLatestAggregatedAnalysisResults({
				projectId: project.id,
			}),
		})),
	);
}

import { command, query } from "$app/server";
import { requireAdmin } from "$lib/server/auth/authorization";
import {
	createClient as createClientService,
	deleteClient as deleteClientService,
	listClients as listAllClients,
	setClientProjectManagers,
	updateClient as updateClientService,
	validateProjectManagerIds,
} from "$lib/server/clients";
import { db } from "$lib/server/db";
import {
	clients,
	projects,
	users,
	usersToClients,
	type Client,
	type User,
} from "$lib/server/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { CreateClient, DeleteClient, UpdateClient } from "./clients.schema";
import { getRequestUser } from "./utilities";

export type ClientInfo = Client & {
	projectManagers: Pick<User, "id" | "firstName" | "lastName" | "email" | "role">[];
};

export const listClients = query(async (): Promise<ClientInfo[]> => {
	const currentUser = await getRequestUser();
	if (!currentUser) return [];

	const clientList =
		currentUser.role === "admin"
			? await listAllClients()
			: (
					await db
						.select({ client: clients })
						.from(usersToClients)
						.innerJoin(
							clients,
							and(eq(clients.id, usersToClients.clientId), isNull(clients.deletedAt)),
						)
						.where(eq(usersToClients.userId, currentUser.id))
				).map(({ client }) => client);

	return attachProjectManagers(clientList, currentUser.role !== "client");
});

export const createClient = command(CreateClient, async (input): Promise<void> => {
	const currentUser = await getRequestUser();
	requireAdmin(currentUser);

	await validateProjectManagerIds(input.projectManagerIds ?? []);
	const client = await createClientService({ name: input.name });
	await setClientProjectManagers(client.id, input.projectManagerIds ?? []);
	await listClients().refresh();
});

export const updateClient = command(UpdateClient, async ([id, input]): Promise<void> => {
	const currentUser = await getRequestUser();
	requireAdmin(currentUser);

	const { projectManagerIds, ...clientUpdates } = input;
	if (projectManagerIds) await validateProjectManagerIds(projectManagerIds);
	if (Object.keys(clientUpdates).length > 0) {
		const updated = await updateClientService(id, clientUpdates);
		if (!updated) throw new Error("Client not found");
	}
	if (projectManagerIds) await setClientProjectManagers(id, projectManagerIds);
	await listClients().refresh();
});

export const deleteClient = command(DeleteClient, async (id): Promise<void> => {
	const currentUser = await getRequestUser();
	requireAdmin(currentUser);

	const activeProject = await db
		.select({ id: projects.id })
		.from(projects)
		.where(and(eq(projects.clientId, id), isNull(projects.deletedAt)))
		.limit(1);
	if (activeProject.length > 0) {
		throw new Error("A client with active projects cannot be deleted");
	}

	const deleted = await deleteClientService(id);
	if (!deleted) throw new Error("Client not found");
	await listClients().refresh();
});

async function attachProjectManagers(
	clientList: Client[],
	includeManagers: boolean,
): Promise<ClientInfo[]> {
	if (clientList.length === 0) return [];
	if (!includeManagers) {
		return clientList.map((client) => ({ ...client, projectManagers: [] }));
	}
	const clientIds = clientList.map(({ id }) => id);
	const rows = await db
		.select({ clientId: usersToClients.clientId, user: users })
		.from(usersToClients)
		.innerJoin(users, eq(users.id, usersToClients.userId))
		.where(
			and(
				inArray(usersToClients.clientId, clientIds),
				inArray(users.role, ["user", "project_manager"]),
			),
		);
	const managersByClient = new Map<string, ClientInfo["projectManagers"]>();
	for (const { clientId, user } of rows) {
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

	return clientList.map((client) => ({
		...client,
		projectManagers: managersByClient.get(client.id) ?? [],
	}));
}

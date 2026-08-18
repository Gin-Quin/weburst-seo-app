import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { clients, users, usersToClients, type Client, type User } from "../db/schema";

export type ClientInsert = Omit<typeof clients.$inferInsert, "id"> & { id?: string };
export type ClientUpdate = Partial<Omit<ClientInsert, "id">>;

export async function createClient(input: ClientInsert): Promise<Client> {
	const [created] = await db
		.insert(clients)
		.values({ ...input, id: input.id ?? crypto.randomUUID() })
		.returning();

	if (!created) throw new Error("Client creation failed");
	return created;
}

export async function getClientById(id: string): Promise<Client | null> {
	const [client] = await db
		.select()
		.from(clients)
		.where(and(eq(clients.id, id), isNull(clients.deletedAt)))
		.limit(1);

	return client ?? null;
}

export async function findClientByName(name: string): Promise<Client | null> {
	const activeClients = await listClients();
	return (
		activeClients.find(
			(client) =>
				client.name.trim().localeCompare(name.trim(), undefined, { sensitivity: "base" }) === 0,
		) ?? null
	);
}

export async function listClients(): Promise<Client[]> {
	return db.select().from(clients).where(isNull(clients.deletedAt));
}

export async function updateClient(id: string, updates: ClientUpdate): Promise<Client | null> {
	if (Object.keys(updates).length === 0) return getClientById(id);

	const [updated] = await db
		.update(clients)
		.set({ ...updates, updatedAt: Date.now() })
		.where(and(eq(clients.id, id), isNull(clients.deletedAt)))
		.returning();

	return updated ?? null;
}

export async function deleteClient(id: string): Promise<Client | null> {
	return updateClient(id, { deletedAt: Date.now() });
}

export async function setUserClientMemberships(user: User, clientIds: string[]): Promise<void> {
	const desiredClientIds = [...new Set(clientIds)];

	if (user.role === "admin" && desiredClientIds.length > 0) {
		throw new Error("Admins cannot be assigned to clients");
	}
	if (user.role === "client" && desiredClientIds.length !== 1) {
		throw new Error("Client users must be assigned to exactly one client");
	}

	if (desiredClientIds.length > 0) {
		const existingClients = await db
			.select({ id: clients.id })
			.from(clients)
			.where(and(inArray(clients.id, desiredClientIds), isNull(clients.deletedAt)));
		if (existingClients.length !== desiredClientIds.length) {
			throw new Error("One or more clients do not exist");
		}
	}

	await db.transaction(async (tx) => {
		await tx.delete(usersToClients).where(eq(usersToClients.userId, user.id));
		if (desiredClientIds.length > 0) {
			await tx
				.insert(usersToClients)
				.values(desiredClientIds.map((clientId) => ({ userId: user.id, clientId })));
		}
	});
}

export async function setClientProjectManagers(
	clientId: string,
	projectManagerIds: string[],
): Promise<void> {
	const desiredManagerIds = await validateProjectManagerIds(projectManagerIds);

	const currentManagers = await db
		.select({ userId: usersToClients.userId })
		.from(usersToClients)
		.innerJoin(users, eq(users.id, usersToClients.userId))
		.where(
			and(eq(usersToClients.clientId, clientId), inArray(users.role, ["user", "project_manager"])),
		);
	const currentManagerIds = currentManagers.map(({ userId }) => userId);

	await db.transaction(async (tx) => {
		if (currentManagerIds.length > 0) {
			await tx
				.delete(usersToClients)
				.where(
					and(
						eq(usersToClients.clientId, clientId),
						inArray(usersToClients.userId, currentManagerIds),
					),
				);
		}
		if (desiredManagerIds.length > 0) {
			await tx
				.insert(usersToClients)
				.values(desiredManagerIds.map((userId) => ({ userId, clientId })))
				.onConflictDoNothing();
		}
	});
}

export async function validateProjectManagerIds(projectManagerIds: string[]): Promise<string[]> {
	const desiredManagerIds = [...new Set(projectManagerIds)];
	const desiredManagers =
		desiredManagerIds.length === 0
			? []
			: await db.select().from(users).where(inArray(users.id, desiredManagerIds));

	if (
		desiredManagers.length !== desiredManagerIds.length ||
		desiredManagers.some((user) => user.role !== "project_manager" && user.role !== "user")
	) {
		throw new Error("Only project managers can be assigned to manage a client");
	}
	return desiredManagerIds;
}

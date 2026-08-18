import { command, query } from "$app/server";
import { requireAdmin } from "$lib/server/auth/authorization";
import { setUserClientMemberships } from "$lib/server/clients";
import { db } from "$lib/server/db";
import { users, usersToClients, type User } from "$lib/server/db/schema";
import {
	createUser,
	deleteUser,
	getUserById,
	listUsers as listAllUsers,
	updateUser,
} from "$lib/server/users";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, inArray } from "drizzle-orm";
import { CreateUser, UpdateCurrentUser, UpdateUserByAdmin } from "./users.schema";
import { getRequestUser } from "./utilities";

export const updateCurrentUser = query(UpdateCurrentUser, async (input): Promise<User | null> => {
	const currentUser = await getRequestUser();
	return currentUser && updateUser(currentUser.id, input);
});

export const deleteCurrentUser = query(async (): Promise<User | null> => {
	const currentUser = await getRequestUser();
	return currentUser && deleteUser(currentUser.id);
});

export const createUserByAdmin = command(CreateUser, async (input): Promise<void> => {
	const currentUser = await getRequestUser();
	requireAdmin(currentUser);
	const { clientIds = [], ...userInput } = input;
	const created = await createUser({ ...userInput, id: createId() });
	try {
		await setUserClientMemberships(created, clientIds);
	} catch (error) {
		await db.delete(users).where(eq(users.id, created.id));
		throw error;
	}
	await listUsers().refresh();
});

export const listUsers = query(async (): Promise<User[]> => {
	const currentUser = await getRequestUser();
	if (!currentUser || currentUser.role === "client") return [];
	if (currentUser.role === "admin") return listAllUsers();

	const memberships = await db
		.select({ clientId: usersToClients.clientId })
		.from(usersToClients)
		.where(eq(usersToClients.userId, currentUser.id));
	const clientIds = memberships.map(({ clientId }) => clientId);
	if (clientIds.length === 0) return [];
	const rows = await db
		.select({ user: users })
		.from(usersToClients)
		.innerJoin(users, eq(users.id, usersToClients.userId))
		.where(
			and(
				inArray(usersToClients.clientId, clientIds),
				inArray(users.role, ["user", "project_manager"]),
			),
		);
	return [...new Map(rows.map(({ user }) => [user.id, user])).values()];
});

export const updateUserByAdmin = command(UpdateUserByAdmin, async ([id, input]): Promise<void> => {
	const currentUser = await getRequestUser();
	requireAdmin(currentUser);
	const existing = await getUserById(id);
	if (!existing) throw new Error("User not found");

	const { clientIds, ...updates } = input;
	await setUserClientMemberships({ ...existing, ...updates }, clientIds);
	const updated = await updateUser(id, updates);
	if (!updated) throw new Error("User not found");
	await listUsers().refresh();
});

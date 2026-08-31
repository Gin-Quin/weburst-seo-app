import { command, query } from "$app/server";
import { requireAdmin, requireClientAccess } from "$lib/server/auth/authorization";
import { roleCanCreateUser } from "$lib/server/auth/permissions";
import { setUserClientMemberships } from "$lib/server/clients";
import { db } from "$lib/server/db";
import { users, usersToClients, type User } from "$lib/server/db/schema";
import { sendClientInvitationNotificationToAdmins } from "$lib/server/email/clientInvitationNotification";
import { sendInvitationEmail } from "$lib/server/email/invitation";
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
	if (!currentUser) return null;
	const { clientInvitationEmailsEnabled: _clientInvitationEmailsEnabled, ...profile } = input;
	return updateUser(currentUser.id, currentUser.role === "admin" ? input : profile);
});

export const deleteCurrentUser = query(async (): Promise<User | null> => {
	const currentUser = await getRequestUser();
	return currentUser && deleteUser(currentUser.id);
});

export const createUserByAdmin = command(CreateUser, async (input): Promise<void> => {
	const currentUser = await getRequestUser();
	if (!currentUser || !roleCanCreateUser(currentUser.role, input.role)) {
		throw new Error("Unauthorized");
	}
	const { clientIds = [], ...userInput } = input;
	if (currentUser.role === "project_manager") {
		await requireClientAccess(currentUser, clientIds[0]!, "manage");
	}
	const created = await createUser({ ...userInput, id: createId() });
	try {
		await setUserClientMemberships(created, clientIds);
	} catch (error) {
		await db.delete(users).where(eq(users.id, created.id));
		throw error;
	}
	await sendInvitationEmail(created, currentUser);
	if (created.role === "client" && currentUser.role === "project_manager") {
		await sendClientInvitationNotificationToAdmins(created, currentUser);
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

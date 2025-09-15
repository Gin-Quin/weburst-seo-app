import { query } from "$app/server";
import type { User } from "$lib/server/db/schema";
import { createUser, deleteUser, listUsers as listAllUsers, updateUser } from "$lib/server/users";
import { createId } from "@paralleldrive/cuid2";
import { CreateUser, UpdateCurrentUser } from "./users.schema";
import { getRequestUser } from "./utilities";

export const updateCurrentUser = query(UpdateCurrentUser, async (input): Promise<User | null> => {
	const currentUser = await getRequestUser();
	return currentUser && updateUser(currentUser.id, input);
});

export const deleteCurrentUser = query(async (): Promise<User | null> => {
	const currentUser = await getRequestUser();
	return currentUser && deleteUser(currentUser.id);
});

export const createUserByAdmin = query(CreateUser, async (input): Promise<User | null> => {
	const currentUser = await getRequestUser();
	if (currentUser?.role !== "admin") return null;
	return await createUser({ ...input, id: createId() });
});

export const listUsers = query(async (): Promise<User[]> => {
	return await listAllUsers();
});

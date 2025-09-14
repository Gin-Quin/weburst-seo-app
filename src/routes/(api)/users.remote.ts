import { query } from "$app/server";
import type { User } from "$lib/server/db/schema";
import { deleteUser, updateUser } from "$lib/server/users";
import { UpdateCurrentUser } from "./users.schema";
import { getRequestUser } from "./utilities";

export const updateCurrentUser = query(UpdateCurrentUser, async (input): Promise<User | null> => {
	const currentUser = await getRequestUser();
	return currentUser && updateUser(currentUser.id, input);
});

export const deleteCurrentUser = query(async (): Promise<User | null> => {
	const currentUser = await getRequestUser();
	return currentUser && deleteUser(currentUser.id);
});

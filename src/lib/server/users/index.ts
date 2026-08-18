import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { deletedUsers, users, type DeletedUser, type Role, type User } from "../db/schema";

export type UserInsert = typeof users.$inferInsert;
export type UserUpdate = Partial<Omit<UserInsert, "id">>;

/**
 * Create a new user.
 * - If no id is provided, a UUID will be generated.
 */
export async function createUser(input: UserInsert): Promise<User> {
	const id = input.id ?? crypto.randomUUID();

	const [created] = await db
		.insert(users)
		.values({ ...input, id })
		.returning();

	if (!created) throw new Error("User creation failed");
	return created;
}

/**
 * Get a user by id.
 */
export async function getUserById(id: string): Promise<User | null> {
	const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
	return row ?? null;
}

/**
 * List users with optional pagination.
 */
export async function listUsers(
	params: { limit?: number; offset?: number; email?: string; role?: Role } = {},
): Promise<User[]> {
	const { limit = 100, offset = 0, email, role } = params;

	const conditions = [];
	if (email) conditions.push(eq(users.email, email));
	if (role) conditions.push(eq(users.role, role));

	if (conditions.length) {
		return db
			.select()
			.from(users)
			.where(and(...conditions))
			.limit(limit)
			.offset(offset);
	}
	return db.select().from(users).limit(limit).offset(offset);
}

/**
 * Update a user by id.
 * - Automatically bumps `updatedAt`.
 * - Returns the updated row, or null if not found.
 */
export async function updateUser(id: string, updates: UserUpdate): Promise<User | null> {
	if (!updates || Object.keys(updates).length === 0) {
		return getUserById(id);
	}

	const [updated] = await db
		.update(users)
		.set({ ...updates, updatedAt: Date.now() })
		.where(eq(users.id, id))
		.returning();

	return updated ?? null;
}

export async function restoreUser(id: string): Promise<User | null> {
	return db.transaction(async (tx) => {
		const [archived] = await tx.select().from(deletedUsers).where(eq(deletedUsers.id, id)).limit(1);
		if (!archived) return null;

		const archivedUser: DeletedUser = archived;
		const { deletedAt: _deletedAt, ...rest } = archivedUser;

		const [restored] = await tx
			.insert(users)
			.values({ ...rest, updatedAt: Date.now() })
			.returning();

		await tx.delete(deletedUsers).where(eq(deletedUsers.id, id));

		return restored ?? null;
	});
}

/**
 * Soft-delete a user by moving it to `deleted_users` using a transaction.
 * - Inserts the existing user row into `deleted_users` (deletedAt is set by DB default).
 * - Deletes the row from `users`.
 * - Returns the original user row, or null if not found.
 */
export async function deleteUser(id: string): Promise<User | null> {
	return db.transaction(async (tx) => {
		const [existing] = await tx.select().from(users).where(eq(users.id, id)).limit(1);
		if (!existing) return null;

		// Archive into deleted_users first
		await tx.insert(deletedUsers).values({ ...existing });

		// Then delete from users
		await tx.delete(users).where(eq(users.id, id));

		return existing;
	});
}

export async function getUserByEmail(email: string): Promise<User | null> {
	const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
	return row ?? null;
}

export async function listDeletedUsers(
	params: { limit?: number; offset?: number; email?: string; role?: Role } = {},
): Promise<DeletedUser[]> {
	const { limit = 100, offset = 0, email, role } = params;

	const conditions = [];
	if (email) conditions.push(eq(deletedUsers.email, email));
	if (role) conditions.push(eq(deletedUsers.role, role));

	if (conditions.length) {
		return db
			.select()
			.from(deletedUsers)
			.where(and(...conditions))
			.limit(limit)
			.offset(offset);
	}
	return db.select().from(deletedUsers).limit(limit).offset(offset);
}

export async function hardDeleteUser(id: string): Promise<DeletedUser | null> {
	const [existing] = await db.select().from(deletedUsers).where(eq(deletedUsers.id, id)).limit(1);
	if (!existing) return null;

	const [deleted] = await db.delete(deletedUsers).where(eq(deletedUsers.id, id)).returning();

	return deleted ?? null;
}

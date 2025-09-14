import { eq } from "drizzle-orm";
import { db } from "../db";
import { projects, type Project } from "../db/schema";

export type ProjectInsert = typeof projects.$inferInsert;
export type ProjectUpdate = Partial<Omit<ProjectInsert, "id">>;

/**
 * Create a new project.
 * - If no id is provided, a UUID will be generated.
 */
export async function createProject(input: ProjectInsert): Promise<Project> {
	const id = input.id ?? crypto.randomUUID();

	const [created] = await db
		.insert(projects)
		.values({ ...input, id })
		.returning();

	return created;
}

/**
 * Get a project by its id.
 */
export async function getProjectById(id: string): Promise<Project | null> {
	const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

	return row ?? null;
}

/**
 * List projects with optional pagination.
 */
export async function listProjects(
	params: { limit?: number; offset?: number } = {},
): Promise<Project[]> {
	const { limit = 100, offset = 0 } = params;

	return db.select().from(projects).limit(limit).offset(offset);
}

/**
 * Update a project by id.
 * - Returns the updated row, or null if not found.
 */
export async function updateProject(id: string, updates: ProjectUpdate): Promise<Project | null> {
	if (!updates || Object.keys(updates).length === 0) {
		return getProjectById(id);
	}

	const [updated] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning();

	return updated ?? null;
}

/**
 * Delete a project by id (hard delete).
 * - Returns the deleted row, or null if not found.
 */
export async function deleteProject(id: string): Promise<Project | null> {
	const [deleted] = await db.delete(projects).where(eq(projects.id, id)).returning();
	return deleted ?? null;
}

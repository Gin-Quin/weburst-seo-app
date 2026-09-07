import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "$lib/server/db/schema";
import { contentTypologies, projects } from "$lib/server/db/schema";

export async function getProjectTypology(db: LibSQLDatabase<typeof schema>, projectId: string, typologyId?: string | null) {
	if (!typologyId) return null;
	const [row] = await db.select({ typology: contentTypologies }).from(contentTypologies)
		.innerJoin(projects, eq(projects.clientId, contentTypologies.clientId))
		.where(and(eq(projects.id, projectId), eq(contentTypologies.id, typologyId))).limit(1);
	if (!row) throw new Error("Cette typologie n’appartient pas au client du projet.");
	return row.typology;
}

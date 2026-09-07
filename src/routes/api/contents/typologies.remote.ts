import { command, query } from "$app/server";
import { requireClientAccess, requireProjectAccess } from "$lib/server/auth/authorization";
import { db } from "$lib/server/db";
import { contentTypologies } from "$lib/server/db/schema";
import { and, eq } from "drizzle-orm";
import { getRequestUser } from "../utilities";
import { SaveTypology, TypologyProject } from "./typologies.schema";

export const listTypologies = query(TypologyProject, async ({ projectId }) => {
	const project = await requireProjectAccess(await getRequestUser(), projectId, "view");
	if (!project.clientId) return [];
	return db.select().from(contentTypologies).where(eq(contentTypologies.clientId, project.clientId)).orderBy(contentTypologies.name);
});

export const saveTypology = command(SaveTypology, async ({ projectId, id, name, instructions }) => {
	const user = await getRequestUser();
	const project = await requireProjectAccess(user, projectId, "manage");
	if (!project.clientId) throw new Error("Associez d’abord ce projet à un client.");
	await requireClientAccess(user, project.clientId, "manage");
	if (id) {
		const updated = await db.update(contentTypologies).set({ name, instructions })
			.where(and(eq(contentTypologies.id, id), eq(contentTypologies.clientId, project.clientId))).returning();
		if (!updated.length) throw new Error("Typologie introuvable.");
	} else {
		id = crypto.randomUUID();
		await db.insert(contentTypologies).values({ id, clientId: project.clientId, name, instructions });
	}
	await listTypologies({ projectId }).refresh();
	return { id };
});

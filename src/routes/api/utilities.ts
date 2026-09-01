import { getRequestEvent } from "$app/server";
import { db } from "$lib/server/db";
import { sessions, type User } from "$lib/server/db/schema";
import { getUserById } from "$lib/server/users";
import { eq } from "drizzle-orm";

export const getRequestBearerToken = (): string | null => {
	const { request } = getRequestEvent();
	return request.headers.get("authorization")?.slice("Bearer ".length) ?? null;
};

export const getRequestUserId = async (): Promise<string | null> => {
	const bearerToken = getRequestBearerToken();
	if (!bearerToken) return null;

	const session = await db.query.sessions.findFirst({
		where: eq(sessions.id, bearerToken),
	});

	return session?.userId ?? null;
};

export const getRequestUser = async (): Promise<User | null> => {
	const userId = await getRequestUserId();
	if (!userId) return null;
	return await getUserById(userId);
};

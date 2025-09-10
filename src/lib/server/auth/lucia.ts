import { Lucia } from "lucia";
import { DrizzleSQLiteAdapter } from "@lucia-auth/adapter-drizzle";
import { db } from "$lib/server/db";
import { sessions, users } from "$lib/server/db/schema";
import { dev } from "$app/environment";

const adapter = new DrizzleSQLiteAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			secure: !dev,
		},
	},
	getUserAttributes: (attributes) => {
		return {
			id: attributes.id,
			email: attributes.email,
			firstName: attributes.firstName,
			lastName: attributes.lastName,
			role: attributes.role,
			emailVerified: attributes.emailVerified,
			projectId: attributes.projectId,
		};
	},
});

declare module "lucia" {
	interface Register {
		Lucia: typeof lucia;
		DatabaseUserAttributes: DatabaseUserAttributes;
	}
}

interface DatabaseUserAttributes {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	role: "admin" | "leader" | "manager";
	emailVerified: boolean;
	projectId: string | null;
}

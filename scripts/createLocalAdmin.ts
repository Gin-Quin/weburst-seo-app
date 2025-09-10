import { db } from "./db";
import { users } from "../src/lib/server/db/schema";
import { createId } from "@paralleldrive/cuid2";

if (import.meta.main) {
	await createLocalAdmin();
}

async function createLocalAdmin() {
	const adminUsers = await db
		.insert(users)
		.values({
			id: createId(),
			email: "gindre.matthieu@gmail.com",
			firstName: "Matthieu",
			lastName: "Gindre",
			role: "admin",
		})

		.returning();

	for (const user of adminUsers) {
		console.log(
			`Created admin user ${user.firstName} ${user.lastName} with email ${user.email}`,
		);
	}
}

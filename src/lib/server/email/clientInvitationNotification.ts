import { db } from "$lib/server/db";
import { users, type User } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import {
	buildClientInvitationNotificationEmail,
	shouldReceiveClientInvitationNotification,
} from "./clientInvitationNotificationContent";
import { sendEmail } from "./sendEmail";

type InvitationUser = Pick<User, "firstName" | "lastName" | "email">;

export async function sendClientInvitationNotificationToAdmins(
	invitedClient: InvitationUser,
	invitedBy: InvitationUser,
): Promise<void> {
	const recipients = (await db.select().from(users).where(eq(users.role, "admin"))).filter(
		shouldReceiveClientInvitationNotification,
	);
	if (recipients.length === 0) return;

	const email = buildClientInvitationNotificationEmail({ invitedClient, invitedBy });
	await Promise.all(
		recipients.map((admin) =>
			sendEmail({
				from: { name: "WeBurst", email: "weburst@app.weburst.fr" },
				to: admin.email,
				...email,
			}),
		),
	);
}

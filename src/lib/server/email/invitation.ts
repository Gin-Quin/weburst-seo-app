import { env as PUBLIC } from "$env/dynamic/public";
import type { User } from "$lib/server/db/schema";
import { buildInvitationEmail } from "./invitationContent";
import { sendEmail } from "./sendEmail";

type InvitationUser = Pick<User, "firstName" | "lastName" | "email">;

export async function sendInvitationEmail(
	invitedUser: InvitationUser,
	invitedBy: InvitationUser,
): Promise<void> {
	const email = buildInvitationEmail({
		invitedUser,
		invitedBy,
		baseUrl: PUBLIC.PUBLIC_BASE_URL,
	});

	await sendEmail({
		from: { name: "WeBurst", email: "weburst@app.weburst.fr" },
		to: invitedUser.email,
		...email,
	});
}

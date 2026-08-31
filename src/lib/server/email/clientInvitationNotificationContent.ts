export type ClientInvitationNotificationUser = {
	firstName: string;
	lastName: string;
	email: string;
};

export function shouldReceiveClientInvitationNotification(user: {
	role: string;
	clientInvitationEmailsEnabled: boolean;
}): boolean {
	return user.role === "admin" && user.clientInvitationEmailsEnabled;
}

function getFullName(user: Pick<ClientInvitationNotificationUser, "firstName" | "lastName">) {
	return `${user.firstName} ${user.lastName}`.trim();
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

export function buildClientInvitationNotificationEmail({
	invitedClient,
	invitedBy,
}: {
	invitedClient: ClientInvitationNotificationUser;
	invitedBy: ClientInvitationNotificationUser;
}) {
	const clientName = getFullName(invitedClient);
	const inviterName = getFullName(invitedBy);
	const safeClientName = escapeHtml(clientName);
	const safeClientEmail = escapeHtml(invitedClient.email);
	const safeInviterName = escapeHtml(inviterName);
	const safeInviterEmail = escapeHtml(invitedBy.email);

	return {
		subject: `Client ${clientName} invité par ${inviterName}`,
		text: `Le client ${clientName} (${invitedClient.email}) a été invité sur WeBurst par ${inviterName} (${invitedBy.email}).`,
		html: `
			<body style="margin:0; padding:20px; background-color:#f8fafc; font-family:Arial, Helvetica, sans-serif;">
				<div style="max-width:600px; margin:0 auto; padding:32px; background-color:#ffffff; border:1px solid #e5e7eb;">
					<h1 style="color:#111827; margin:0 0 20px; font-size:24px;">Nouveau client invité</h1>
					<p style="color:#374151; margin:0; font-size:15px; line-height:1.6;">
						Le client <strong>${safeClientName}</strong> (${safeClientEmail}) a été invité sur WeBurst par <strong>${safeInviterName}</strong> (${safeInviterEmail}).
					</p>
				</div>
			</body>
		`,
	};
}

export type InvitationUser = {
	firstName: string;
	lastName: string;
	email: string;
};

function getFullName(user: Pick<InvitationUser, "firstName" | "lastName">): string {
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

export function buildInvitationEmail({
	invitedUser,
	invitedBy,
	baseUrl,
}: {
	invitedUser: InvitationUser;
	invitedBy: InvitationUser;
	baseUrl: string;
}) {
	const invitedUserName = getFullName(invitedUser);
	const inviterName = getFullName(invitedBy);
	const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
	const loginUrl = `${normalizedBaseUrl}/login`;
	const logoUrl = `${normalizedBaseUrl}/weburst-logo.png`;
	const safeInvitedUserName = escapeHtml(invitedUserName);
	const safeInviterName = escapeHtml(inviterName);
	const safeInviterEmail = escapeHtml(invitedBy.email);
	const safeLoginUrl = escapeHtml(loginUrl);
	const safeLogoUrl = escapeHtml(logoUrl);

	return {
		subject: `${inviterName} vous invite à rejoindre WeBurst`,
		text: `Bonjour ${invitedUserName},

${inviterName} (${invitedBy.email}) vous invite à rejoindre WeBurst pour collaborer sur vos projets SEO.

Connectez-vous à WeBurst : ${loginUrl}

Lors de votre première connexion, saisissez votre adresse ${invitedUser.email}, puis demandez votre lien magique.

Si vous ne vous attendiez pas à recevoir cette invitation, vous pouvez ignorer cet email.

L'équipe WeBurst`,
		html: `
			<body style="margin:0; padding:20px; background-color:#f8fafc; font-family:Arial, Helvetica, sans-serif;">
				<div style="max-width:600px; margin:0 auto; background-color:#ffffff; border:1px solid #e5e7eb;">
					<div style="text-align:center; padding:25px 0 20px;">
						<img src="${safeLogoUrl}" alt="Logo WeBurst" width="120" style="display:block; margin:0 auto; max-width:120px; height:auto;">
					</div>

					<div style="background-color:#9453f4; padding:40px 30px; text-align:center;">
						<h1 style="color:#ffffff; margin:0; font-size:26px; font-weight:bold;">Vous êtes invité(e) sur WeBurst</h1>
						<p style="color:#ede9fe; margin:8px 0 0; font-size:16px;">Collaborez sur vos projets SEO</p>
					</div>

					<div style="padding:40px 30px;">
						<h2 style="color:#111827; margin:0 0 20px; font-size:22px; font-weight:bold;">Bonjour ${safeInvitedUserName},</h2>
						<p style="color:#374151; margin:0 0 16px; font-size:15px; line-height:1.6;">
							<strong>${safeInviterName}</strong> (${safeInviterEmail}) vous invite à rejoindre WeBurst pour collaborer sur vos projets SEO.
						</p>
						<p style="color:#374151; margin:0 0 30px; font-size:15px; line-height:1.6;">
							Lors de votre première connexion, saisissez votre adresse email puis demandez votre lien magique.
						</p>

						<div style="text-align:center; margin:30px 0;">
							<a href="${safeLoginUrl}" style="display:inline-block; padding:14px 28px; background-color:#9453f4; color:#ffffff; text-decoration:none; font-size:16px; font-weight:bold; border-radius:32px;">
								Se connecter à WeBurst
							</a>
						</div>

						<div style="margin-top:30px; padding-top:20px; border-top:1px solid #e5e7eb;">
							<p style="color:#6b7280; margin:0 0 10px; font-size:13px;">Un souci avec le bouton ? Copiez-collez ce lien :</p>
							<p style="word-break:break-all; color:#6d28d9; font-family:Courier, monospace; font-size:12px; background-color:#f8fafc; padding:10px; margin:0;">${safeLoginUrl}</p>
						</div>
					</div>

					<div style="background-color:#f9fafb; padding:25px; border-top:1px solid #e5e7eb; text-align:center;">
						<p style="color:#9ca3af; margin:0 0 8px; font-size:13px;">Si vous ne vous attendiez pas à recevoir cette invitation, vous pouvez ignorer cet email.</p>
						<p style="color:#d1d5db; margin:0; font-size:11px;">L’équipe WeBurst</p>
					</div>
				</div>
			</body>
		`,
	};
}

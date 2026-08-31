export function buildContentQuotaWarningEmail(remaining: number, appUrl: string) {
	const noContentRemaining = remaining === 0;
	const contentLabel = remaining === 1 ? "contenu" : "contenus";
	const subject = noContentRemaining
		? "Votre quota de contenus est épuisé"
		: `Plus que ${remaining} ${contentLabel} disponible${remaining === 1 ? "" : "s"}`;

	return {
		subject,
		html: `
			<body style="margin:0; padding:20px; background-color:#f8fafc; font-family:Arial, Helvetica, sans-serif;">
				<div style="max-width:600px; margin:0 auto; overflow:hidden; background-color:#ffffff; border:1px solid #e5e7eb; border-radius:16px;">
					<div style="text-align:center; padding:24px 0 12px;">
						<img src="${appUrl}/weburst-logo.png" alt="Weburst" width="120" style="display:block; margin:0 auto; max-width:120px; height:auto;">
					</div>
					<div style="background-color:#9453f4; padding:32px 30px; text-align:center;">
						<h1 style="color:#ffffff; margin:0; font-size:25px; font-weight:bold;">${
							noContentRemaining
								? "Votre quota est épuisé"
								: `${remaining} ${contentLabel} restant${remaining === 1 ? "" : "s"}`
						}</h1>
					</div>
					<div style="padding:36px 30px; color:#374151; font-size:16px; line-height:1.6;">
						<p style="margin:0 0 20px;">${
							noContentRemaining
								? "Vous avez utilisé tous les contenus inclus dans votre abonnement actuel."
								: `Il vous reste ${remaining} ${contentLabel} à créer avec votre abonnement actuel.`
						}</p>
						<p style="margin:0 0 28px;">Passez à un abonnement supérieur pour augmenter votre nombre de contenus disponibles.</p>
						<div style="text-align:center;">
							<a href="${appUrl}" style="display:inline-block; padding:13px 24px; background-color:#9453f4; color:#ffffff; text-decoration:none; font-size:16px; font-weight:bold; border-radius:999px;">Accéder à mon compte</a>
						</div>
					</div>
				</div>
			</body>
		`,
	};
}

import { env as PUBLIC } from "$env/dynamic/public";
import { buildContentQuotaWarningEmail } from "./contentQuotaWarning";
import { sendEmail } from "./sendEmail";

export async function sendContentQuotaWarningEmail(to: string, remaining: number) {
	const appUrl = PUBLIC.PUBLIC_BASE_URL.replace(/\/$/, "");
	const content = buildContentQuotaWarningEmail(remaining, appUrl);

	await sendEmail({
		from: "weburst@app.weburst.fr",
		to,
		...content,
	});
}

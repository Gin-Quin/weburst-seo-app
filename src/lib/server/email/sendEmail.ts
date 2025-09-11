import { env } from "$env/dynamic/private";

export async function sendEmail({
	from,
	to,
	subject,
	reply_to,
	headers,
	scheduled_at,
	attachments,
	...content
}: {
	from:
		| string
		| {
				name: string;
				email: string;
		  };
	to: string;
	subject: string;
	reply_to?: string | string[];
	headers?: Record<string, string>;
	scheduled_at?: string; // ISO 8601 format (e.g: 2024-08-05T11:52:01.858Z)
	attachments?: Array<{
		filename: string;
		content: string | Buffer;
	}>;
} & ({ html: string } | { text: string })) {
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
		},
		body: JSON.stringify({
			from: typeof from == "string" ? from : `${from.name} <${from.email}>`,
			to,
			subject,
			reply_to,
			headers,
			scheduled_at,
			attachments,
			...content,
		}),
	});

	if (!response.ok) {
		console.error("error", `Failed to send email: ${response.statusText}`, { from, to, subject });
	}
}

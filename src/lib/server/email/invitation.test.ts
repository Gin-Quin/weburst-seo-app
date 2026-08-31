import { describe, expect, test } from "bun:test";
import { buildInvitationEmail } from "./invitationContent";

describe("buildInvitationEmail", () => {
	test("includes the recipient, inviter and WeBurst login link", () => {
		const email = buildInvitationEmail({
			invitedUser: {
				firstName: "Jeanne",
				lastName: "Martin",
				email: "jeanne@example.com",
			},
			invitedBy: {
				firstName: "Alex",
				lastName: "Dupont",
				email: "alex@weburst.fr",
			},
			baseUrl: "https://app.weburst.fr/",
		});

		expect(email.subject).toBe("Alex Dupont vous invite à rejoindre WeBurst");
		expect(email.text).toContain("Alex Dupont (alex@weburst.fr)");
		expect(email.text).toContain("https://app.weburst.fr/login");
		expect(email.html).toContain("Bonjour Jeanne Martin,");
		expect(email.html).toContain('href="https://app.weburst.fr/login"');
	});

	test("escapes user-provided values in the HTML version", () => {
		const email = buildInvitationEmail({
			invitedUser: {
				firstName: "<Jeanne>",
				lastName: "Martin",
				email: "jeanne@example.com",
			},
			invitedBy: {
				firstName: "Alex & associés",
				lastName: "Dupont",
				email: "alex+test@weburst.fr",
			},
			baseUrl: "https://app.weburst.fr",
		});

		expect(email.html).toContain("Bonjour &lt;Jeanne&gt; Martin,");
		expect(email.html).toContain("Alex &amp; associés Dupont");
		expect(email.html).not.toContain("Bonjour <Jeanne> Martin,");
	});
});

import { describe, expect, test } from "bun:test";
import {
	buildClientInvitationNotificationEmail,
	shouldReceiveClientInvitationNotification,
} from "./clientInvitationNotificationContent";

describe("client invitation admin notification", () => {
	test("uses the requested client and project manager wording", () => {
		const email = buildClientInvitationNotificationEmail({
			invitedClient: {
				firstName: "Jeanne",
				lastName: "Martin",
				email: "jeanne@example.com",
			},
			invitedBy: {
				firstName: "Alex",
				lastName: "Dupont",
				email: "alex@weburst.fr",
			},
		});

		expect(email.subject).toBe("Client Jeanne Martin invité par Alex Dupont");
		expect(email.text).toContain("jeanne@example.com");
		expect(email.text).toContain("alex@weburst.fr");
	});

	test("escapes user-provided values in HTML", () => {
		const email = buildClientInvitationNotificationEmail({
			invitedClient: { firstName: "<Jeanne>", lastName: "Martin", email: "j@example.com" },
			invitedBy: { firstName: "Alex & Co", lastName: "Dupont", email: "a@example.com" },
		});

		expect(email.html).toContain("&lt;Jeanne&gt;");
		expect(email.html).toContain("Alex &amp; Co");
		expect(email.html).not.toContain("<Jeanne>");
	});

	test("only includes subscribed admins", () => {
		expect(
			shouldReceiveClientInvitationNotification({
				role: "admin",
				clientInvitationEmailsEnabled: true,
			}),
		).toBe(true);
		expect(
			shouldReceiveClientInvitationNotification({
				role: "admin",
				clientInvitationEmailsEnabled: false,
			}),
		).toBe(false);
		expect(
			shouldReceiveClientInvitationNotification({
				role: "project_manager",
				clientInvitationEmailsEnabled: true,
			}),
		).toBe(false);
	});
});

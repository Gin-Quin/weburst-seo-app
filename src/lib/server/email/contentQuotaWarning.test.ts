import { describe, expect, test } from "bun:test";
import { buildContentQuotaWarningEmail } from "./contentQuotaWarning";

describe("content quota warning email", () => {
	test("uses singular wording for one remaining content", () => {
		const email = buildContentQuotaWarningEmail(1, "https://app.weburst.fr");

		expect(email.subject).toBe("Plus que 1 contenu disponible");
		expect(email.html).toContain("1 contenu restant");
		expect(email.html).toContain("abonnement supérieur");
	});

	test("explains when no content remains", () => {
		const email = buildContentQuotaWarningEmail(0, "https://app.weburst.fr");

		expect(email.subject).toBe("Votre quota de contenus est épuisé");
		expect(email.html).toContain("utilisé tous les contenus");
		expect(email.html).toContain('href="https://app.weburst.fr"');
	});
});

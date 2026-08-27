import { describe, expect, test } from "bun:test";
import {
	CONTENT_QUOTA_EXCEEDED_MESSAGE,
	getContentCreationPolicy,
	isContentQuotaReached,
} from "./quota";

describe("content creation quota", () => {
	test("applies the project limit only to client users on monthly subscriptions", () => {
		expect(
			getContentCreationPolicy("client", { type: "monthly_subscription", articleLimit: 4 }),
		).toEqual({ allowed: true, limit: 4 });
		expect(getContentCreationPolicy("project_manager", { type: "audit", articleLimit: 0 })).toEqual(
			{ allowed: true, limit: null },
		);
	});

	test("blocks client users from content creation on other project types", () => {
		expect(getContentCreationPolicy("client", { type: "audit", articleLimit: 10 })).toEqual({
			allowed: false,
			limit: null,
		});
	});

	test("treats the quota as reached at or above the limit", () => {
		expect(isContentQuotaReached(2, 3)).toBe(false);
		expect(isContentQuotaReached(3, 3)).toBe(true);
		expect(isContentQuotaReached(4, 3)).toBe(true);
		expect(CONTENT_QUOTA_EXCEEDED_MESSAGE).toBe(
			"Vous avez utilisé votre quota de contenus, veuillez passer à l'abonnement supérieur",
		);
	});
});

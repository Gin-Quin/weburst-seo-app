import { describe, expect, test } from "bun:test";
import type { Role } from "$lib/server/db/schema";
import { roleCanAccessClient } from "$lib/server/auth/permissions";
import { canManageKeywords } from "./access";

describe("keyword action permissions", () => {
	const cases: Array<[Role | null | undefined, boolean]> = [
		["admin", true],
		["project_manager", true],
		["client", false],
		["user", false],
		[null, false],
		[undefined, false],
	];

	for (const [role, allowed] of cases) {
		test(`${role}: keyword actions allowed = ${allowed}`, () => {
			expect(canManageKeywords(role)).toBe(allowed);
			if (role) {
				expect(roleCanAccessClient(role, true, "manage")).toBe(allowed);
				expect(roleCanAccessClient(role, false, "manage")).toBe(role === "admin");
			}
		});
	}
});

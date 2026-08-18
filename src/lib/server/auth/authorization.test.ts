import { describe, expect, test } from "bun:test";
import { roleCanAccessClient, type ClientAction } from "./permissions";
import type { Role } from "../db/schema";

describe("roleCanAccessClient", () => {
	const cases: Array<{
		role: Role;
		member: boolean;
		action: ClientAction;
		allowed: boolean;
	}> = [
		{ role: "admin", member: false, action: "view", allowed: true },
		{ role: "admin", member: false, action: "manage", allowed: true },
		{ role: "project_manager", member: true, action: "view", allowed: true },
		{ role: "project_manager", member: true, action: "manage", allowed: true },
		{ role: "project_manager", member: false, action: "view", allowed: false },
		{ role: "project_manager", member: false, action: "manage", allowed: false },
		{ role: "client", member: true, action: "view", allowed: true },
		{ role: "client", member: true, action: "manage", allowed: false },
		{ role: "client", member: false, action: "view", allowed: false },
		{ role: "client", member: false, action: "manage", allowed: false },
		{ role: "user", member: true, action: "manage", allowed: true },
	];

	for (const { role, member, action, allowed } of cases) {
		test(`${role} ${member ? "with" : "without"} membership can ${action}: ${allowed}`, () => {
			expect(roleCanAccessClient(role, member, action)).toBe(allowed);
		});
	}
});

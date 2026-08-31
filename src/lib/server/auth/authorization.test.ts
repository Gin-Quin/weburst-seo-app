import { describe, expect, test } from "bun:test";
import { roleCanAccessClient, roleCanCreateUser, type ClientAction } from "./permissions";
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
		{ role: "user", member: true, action: "view", allowed: true },
		{ role: "user", member: true, action: "manage", allowed: false },
	];

	for (const { role, member, action, allowed } of cases) {
		test(`${role} ${member ? "with" : "without"} membership can ${action}: ${allowed}`, () => {
			expect(roleCanAccessClient(role, member, action)).toBe(allowed);
		});
	}
});

test("admins can create every profile while project managers can only create clients", () => {
	expect(roleCanCreateUser("admin", "admin")).toBe(true);
	expect(roleCanCreateUser("admin", "project_manager")).toBe(true);
	expect(roleCanCreateUser("admin", "client")).toBe(true);
	expect(roleCanCreateUser("project_manager", "client")).toBe(true);
	expect(roleCanCreateUser("project_manager", "project_manager")).toBe(false);
	expect(roleCanCreateUser("client", "client")).toBe(false);
});

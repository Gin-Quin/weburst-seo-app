import { expect, test } from "bun:test";
import { canAccessClientPage, canAccessClientsArea } from "./clientPageAccess";

test("only admins and project managers can enter the clients area", () => {
	expect(canAccessClientsArea("admin")).toBe(true);
	expect(canAccessClientsArea("project_manager")).toBe(true);
	expect(canAccessClientsArea("client")).toBe(false);
	expect(canAccessClientsArea("user")).toBe(false);
});

test("a project manager is limited to assigned client ids", () => {
	expect(canAccessClientPage("project_manager", "client-a", ["client-a"])).toBe(true);
	expect(canAccessClientPage("project_manager", "client-b", ["client-a"])).toBe(false);
});

test("an admin still needs the requested id to exist in the accessible list", () => {
	expect(canAccessClientPage("admin", "client-a", ["client-a", "client-b"])).toBe(true);
	expect(canAccessClientPage("admin", "missing", ["client-a", "client-b"])).toBe(false);
});

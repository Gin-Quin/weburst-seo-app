import { expect, test } from "bun:test";
import { canViewProjectContents } from "./access";

test("client users see Contents only for monthly subscriptions", () => {
	expect(canViewProjectContents("client", "monthly_subscription")).toBe(true);
	expect(canViewProjectContents("client", "audit")).toBe(false);
	expect(canViewProjectContents("client", "prospect")).toBe(false);
	expect(canViewProjectContents("project_manager", "audit")).toBe(true);
	expect(canViewProjectContents("admin", "prospect")).toBe(true);
});

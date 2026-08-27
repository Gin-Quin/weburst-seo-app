import { describe, expect, test } from "bun:test";
import { safeParse } from "valibot";
import { CreateUser } from "./users.schema";

const baseUser = {
	firstName: "Jeanne",
	lastName: "Martin",
	email: "jeanne@example.com",
} as const;

describe("CreateUser", () => {
	test("accepts a client profile attached to exactly one client", () => {
		expect(
			safeParse(CreateUser, {
				...baseUser,
				role: "client",
				clientIds: ["client-1"],
			}).success,
		).toBe(true);
	});

	test("rejects a client profile without exactly one client", () => {
		expect(safeParse(CreateUser, { ...baseUser, role: "client" }).success).toBe(false);
		expect(
			safeParse(CreateUser, {
				...baseUser,
				role: "client",
				clientIds: ["client-1", "client-2"],
			}).success,
		).toBe(false);
	});
});

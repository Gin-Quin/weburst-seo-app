import * as v from "valibot";

export const UpdateCurrentUser = v.object({
	firstName: v.string(),
	lastName: v.string(),
	clientInvitationEmailsEnabled: v.optional(v.boolean()),
});
export type UpdateCurrentUser = v.InferOutput<typeof UpdateCurrentUser>;

export const CreateUser = v.pipe(
	v.object({
		firstName: v.string(),
		lastName: v.string(),
		email: v.pipe(v.string(), v.email()),
		role: v.picklist(["admin", "project_manager", "client"]),
		clientIds: v.optional(v.array(v.string())),
	}),
	v.check(
		(input) => input.role !== "client" || input.clientIds?.length === 1,
		"Un profil client doit être rattaché à un client.",
	),
);
export type CreateUser = v.InferOutput<typeof CreateUser>;

export const UpdateUserByAdmin = v.tuple([
	v.string(),
	v.object({
		firstName: v.string(),
		lastName: v.string(),
		email: v.pipe(v.string(), v.email()),
		role: v.picklist(["admin", "project_manager", "client"]),
		clientIds: v.array(v.string()),
	}),
]);

import * as v from "valibot";

export const UpdateCurrentUser = v.object({
	firstName: v.string(),
	lastName: v.string(),
});
export type UpdateCurrentUser = v.InferOutput<typeof UpdateCurrentUser>;

export const CreateUser = v.object({
	firstName: v.string(),
	lastName: v.string(),
	email: v.pipe(v.string(), v.email()),
	role: v.picklist(["admin", "user"]),
});
export type CreateUser = v.InferOutput<typeof CreateUser>;

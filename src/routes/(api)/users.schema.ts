import * as v from "valibot";

export const UpdateCurrentUser = v.object({
	firstName: v.string(),
	lastName: v.string(),
});
export type UpdateCurrentUser = v.InferOutput<typeof UpdateCurrentUser>;

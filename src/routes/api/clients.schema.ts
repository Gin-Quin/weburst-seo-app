import * as v from "valibot";

export const CreateClient = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1)),
	projectManagerIds: v.optional(v.array(v.string())),
});
export type CreateClient = v.InferOutput<typeof CreateClient>;

export const ClientUpdate = v.partial(
	v.object({
		name: v.pipe(v.string(), v.trim(), v.minLength(1)),
		projectManagerIds: v.array(v.string()),
	}),
);
export type ClientUpdate = v.InferOutput<typeof ClientUpdate>;

export const UpdateClient = v.tuple([v.string(), ClientUpdate]);
export const DeleteClient = v.string();

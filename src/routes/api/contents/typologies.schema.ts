import * as v from "valibot";

export const TypologyProject = v.object({ projectId: v.pipe(v.string(), v.minLength(1)) });
export const SaveTypology = v.object({
	projectId: v.pipe(v.string(), v.minLength(1)),
	id: v.optional(v.pipe(v.string(), v.minLength(1))),
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
	instructions: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(20_000)),
});

import { expect, test } from "bun:test";
import * as v from "valibot";
import { CreateContent, SaveDraft, UpdateContent } from "./contents.schema";

test("CreateContent rejects an empty title", () => {
	expect(v.safeParse(CreateContent, { projectId: "p1", title: "   " }).success).toBe(false);
});

test("UpdateContent accepts clearing optional metadata", () => {
	expect(
		v.safeParse(UpdateContent, {
			projectId: "p1",
			id: "c1",
			title: "Article mis à jour",
			cluster: "",
			priority: null,
			brief: "Nouveau brief",
		}).success,
	).toBe(true);
});

test("SaveDraft accepts a ProseMirror payload string", () => {
	expect(
		v.safeParse(SaveDraft, {
			projectId: "p1",
			id: "c1",
			contentHtml: "<p>Article</p>",
			contentJson: '{"type":"doc"}',
		}).success,
	).toBe(true);
});

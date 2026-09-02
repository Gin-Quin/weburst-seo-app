import { expect, test } from "bun:test";
import { MAX_CHAT_MEMORY_LENGTH } from "$lib/contents/chatMemory";
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
			chatMemory: "",
		}).success,
	).toBe(true);
});

test("UpdateContent validates the content memory limit", () => {
	const input = {
		projectId: "p1",
		id: "c1",
		title: "Article",
		cluster: "",
		priority: null,
		brief: "",
	};
	expect(v.safeParse(UpdateContent, { ...input, chatMemory: "a".repeat(MAX_CHAT_MEMORY_LENGTH) }).success).toBe(
		true,
	);
	expect(
		v.safeParse(UpdateContent, { ...input, chatMemory: "a".repeat(MAX_CHAT_MEMORY_LENGTH + 1) })
			.success,
	).toBe(false);
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

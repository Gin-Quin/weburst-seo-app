import { expect, test } from "bun:test";
import { getProjectPath } from "./getProjectPath";

test("keeps the share of voice section when switching projects", () => {
	expect(getProjectPath("project-b", "/projects/project-a/share-of-voice")).toBe(
		"/projects/project-b/share-of-voice",
	);
});

test("keeps the similarities section when switching projects", () => {
	expect(getProjectPath("project-b", "/projects/project-a/keyword-similarities")).toBe(
		"/projects/project-b/keyword-similarities",
	);
});

test("keeps the contents section when switching projects", () => {
	expect(getProjectPath("project-b", "/projects/project-a/contents")).toBe(
		"/projects/project-b/contents",
	);
});

test("defaults to share of voice from non-project pages", () => {
	expect(getProjectPath("project-b", "/")).toBe(
		"/projects/project-b/share-of-voice",
	);
});

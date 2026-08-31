import { expect, test } from "bun:test";
import { groupProjectsByClient } from "./groupProjectsByClient";

test("groups every accessible project by client and puts the current client first", () => {
	const projects = [
		{
			id: "smartof",
			clientId: "talers",
			clientName: "Talers",
			client: { name: "Talers" },
			domain: "www.smartof.tech",
		},
		{
			id: "novlaw",
			clientId: "novlaww",
			clientName: "Old Novlaww name",
			client: { name: "Novlaww" },
			domain: "novlaw.fr",
		},
	];

	const groups = groupProjectsByClient(projects, "novlaww");

	expect(groups.map(({ clientName }) => clientName)).toEqual(["Novlaww", "Talers"]);
	expect(groups.flatMap(({ projects }) => projects.map(({ id }) => id))).toEqual([
		"novlaw",
		"smartof",
	]);
});

test("keeps legacy projects without a client id available", () => {
	const projects = [
		{
			id: "legacy",
			clientId: null,
			clientName: "Legacy client",
			domain: "legacy.fr",
		},
	];

	expect(groupProjectsByClient(projects)).toEqual([
		{
			clientId: null,
			clientName: "Legacy client",
			projects,
		},
	]);
});

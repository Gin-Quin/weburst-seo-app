import { expect, test } from "bun:test";
import { buildContentChatSystemPrompt } from "./contentChatPrompt";

const content = {
	title: "Choisir un vélo cargo",
	existingUrl: null,
	cluster: null,
	chatMemory: "Cibler les familles urbaines.",
	brief: "Comparer les modèles compacts.",
	contentHtml: "",
	contentText: "",
	serpmanticsGuide: null,
	serpmanticsAnalysis: null,
};
const clientContext = {
	context: "Le client vend des vélos cargo.",
	memory: "Toujours utiliser le vouvoiement.",
};

test("includes the linked typology alongside client context and memories before any chat history", () => {
	const typology = {
		name: "Guide pratique",
		instructions: "Adopter un ton pédagogique.\nTerminer par une liste de conseils.",
	};
	const prompt = buildContentChatSystemPrompt(content, clientContext, typology, "Exemple de guide.");

	expect(prompt).toContain(`${typology.name}\n${typology.instructions}`);
	expect(prompt).toContain(clientContext.context);
	expect(prompt).toContain(clientContext.memory);
	expect(prompt).toContain(content.chatMemory);
	expect(prompt).toContain(content.brief);
	expect(prompt).toContain("Exemple de guide.");
});

test("supports content without a typology while keeping its context", () => {
	const prompt = buildContentChatSystemPrompt(content, clientContext, null, "");

	expect(prompt).toContain("Typologie éditoriale (base de rédaction pour ce client) :\naucune");
	expect(prompt).toContain(clientContext.context);
	expect(prompt).toContain(content.chatMemory);
});

test("uses the current typology instructions on each request", () => {
	const previous = { name: "Guide pratique", instructions: "Anciennes consignes." };
	const updated = { ...previous, instructions: "Nouvelles consignes : ton direct." };
	const first = buildContentChatSystemPrompt(content, clientContext, previous, "");
	const next = buildContentChatSystemPrompt(content, clientContext, updated, "");

	expect(first).toContain(previous.instructions);
	expect(next).toContain(updated.instructions);
	expect(next).not.toContain(previous.instructions);
});

import { expect, test } from "bun:test";
import { Schema, type Node as ProseMirrorNode } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { EditorState, TextSelection } from "prosemirror-state";
import { setListType } from "./editorLists";

const schema = new Schema({
	nodes: addListNodes(basicSchema.spec.nodes, "paragraph block*", "block"),
	marks: basicSchema.spec.marks,
});
const bulletList = schema.nodes.bullet_list!;
const orderedList = schema.nodes.ordered_list!;
const listItem = schema.nodes.list_item!;

function list(type: "bullet_list" | "ordered_list", labels: string[]) {
	return schema.node(
		type,
		null,
		labels.map((label) =>
			schema.node("list_item", null, schema.node("paragraph", null, schema.text(label))),
		),
	);
}

function textPositions(doc: ProseMirrorNode) {
	const positions: number[] = [];
	doc.descendants((node, position) => {
		if (node.isText) positions.push(position);
	});
	return positions;
}

test("setListType changes an ordered list into a bullet list", () => {
	const doc = schema.node("doc", null, list("ordered_list", ["First", "Second"]));
	const [first, second] = textPositions(doc);
	const state = EditorState.create({
		doc,
		selection: TextSelection.create(doc, first!, second! + 2),
	});
	let nextState: EditorState | undefined;

	expect(
		setListType(bulletList, listItem)(state, (transaction) => {
			nextState = state.apply(transaction);
		}),
	).toBe(true);
	expect(nextState?.doc.firstChild?.type).toBe(bulletList);
	expect(nextState?.doc.textContent).toBe("FirstSecond");
});

test("setListType changes a bullet list into an ordered list", () => {
	const doc = schema.node("doc", null, list("bullet_list", ["First"]));
	const [first] = textPositions(doc);
	const state = EditorState.create({
		doc,
		selection: TextSelection.create(doc, first!),
	});
	let nextState: EditorState | undefined;

	setListType(orderedList, listItem)(state, (transaction) => {
		nextState = state.apply(transaction);
	});

	expect(nextState?.doc.firstChild?.type).toBe(orderedList);
	expect(nextState?.doc.firstChild?.attrs.order).toBe(1);
});

test("setListType wraps paragraphs that are not already in a list", () => {
	const paragraph = schema.node("paragraph", null, schema.text("First"));
	const doc = schema.node("doc", null, paragraph);
	const state = EditorState.create({
		doc,
		selection: TextSelection.create(doc, 1),
	});
	let nextState: EditorState | undefined;

	setListType(bulletList, listItem)(state, (transaction) => {
		nextState = state.apply(transaction);
	});

	expect(nextState?.doc.firstChild?.type).toBe(bulletList);
});

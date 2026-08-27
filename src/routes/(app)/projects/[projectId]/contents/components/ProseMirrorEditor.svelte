<script lang="ts">
	import { convertAsciiTablesInHtml } from "$lib/contents/articleHtml";
	import { onMount } from "svelte";
	import { Schema, DOMParser as ProseMirrorDOMParser, DOMSerializer, type MarkSpec, type MarkType } from "prosemirror-model";
	import { EditorState, type Command } from "prosemirror-state";
	import { EditorView } from "prosemirror-view";
	import { schema as basicSchema } from "prosemirror-schema-basic";
	import { addListNodes, wrapInList } from "prosemirror-schema-list";
	import { history, redo, undo } from "prosemirror-history";
	import { baseKeymap, setBlockType, toggleMark } from "prosemirror-commands";
	import { keymap } from "prosemirror-keymap";
	import { tableEditing, tableNodes } from "prosemirror-tables";
	import {
		InputRule,
		inputRules,
		textblockTypeInputRule,
		undoInputRule,
		wrappingInputRule,
	} from "prosemirror-inputrules";
	import IconArrowCounterClockwiseRegular from "phosphor-icons-svelte/IconArrowCounterClockwiseRegular.svelte";
	import IconArrowClockwiseRegular from "phosphor-icons-svelte/IconArrowClockwiseRegular.svelte";
	import IconListBulletsRegular from "phosphor-icons-svelte/IconListBulletsRegular.svelte";
	import IconListNumbersRegular from "phosphor-icons-svelte/IconListNumbersRegular.svelte";
	import IconTextBRegular from "phosphor-icons-svelte/IconTextBRegular.svelte";
	import IconTextItalicRegular from "phosphor-icons-svelte/IconTextItalicRegular.svelte";
	import IconTextUnderlineRegular from "phosphor-icons-svelte/IconTextUnderlineRegular.svelte";

	let {
		html,
		readOnly = false,
		onChange,
		setEditorContent = $bindable(),
	}: {
		html: string;
		readOnly?: boolean;
		onChange?: (value: { html: string; json: string; text: string }) => void;
		setEditorContent?: (html: string) => EditorContent | undefined;
	} = $props();
	type EditorContent = { html: string; json: string; text: string };
	type BlockStyle = "paragraph" | "h1" | "h2" | "h3";

	const underline: MarkSpec = {
		parseDOM: [{ tag: "u" }, { style: "text-decoration=underline" }],
		toDOM: () => ["u", 0],
	};
	const nodes = addListNodes(basicSchema.spec.nodes, "paragraph block*", "block").append(
		tableNodes({ tableGroup: "block", cellContent: "block+", cellAttributes: {} }),
	);
	const schema = new Schema({
		nodes,
		marks: basicSchema.spec.marks.append({ underline }),
	});
	const strongMark = schema.marks.strong!;
	const emphasisMark = schema.marks.em!;
	const underlineMark = schema.marks.underline!;
	const codeMark = schema.marks.code!;
	const paragraphNode = schema.nodes.paragraph!;
	const headingNode = schema.nodes.heading!;
	const blockquoteNode = schema.nodes.blockquote!;
	const codeBlockNode = schema.nodes.code_block!;
	const bulletListNode = schema.nodes.bullet_list!;
	const orderedListNode = schema.nodes.ordered_list!;

	let mount: HTMLDivElement;
	let view: EditorView | undefined;
	let suppressChange = false;
	let lastHtml = html;
	let revision = $state(0);
	let selectedBlock = $state<BlockStyle>("paragraph");

	setEditorContent = (nextHtml: string): EditorContent | undefined => {
		if (!view) return undefined;
		suppressChange = true;
		const nextDoc = parseHtml(nextHtml);
		view.updateState(
			EditorState.create({
				doc: nextDoc,
				plugins: createPlugins(),
			}),
		);
		syncSelectedBlock();
		lastHtml = serializeHtml();
		const value = {
			html: lastHtml,
			json: JSON.stringify(view.state.doc.toJSON()),
			text: view.state.doc.textBetween(0, view.state.doc.content.size, "\n\n"),
		};
		suppressChange = false;
		revision += 1;
		return value;
	};

	$effect(() => {
		if (view) view.setProps({ editable: () => !readOnly });
	});

	$effect(() => {
		if (view && html !== lastHtml) setEditorContent?.(html);
	});

	onMount(() => {
		view = new EditorView(mount, {
			state: EditorState.create({ doc: parseHtml(html), plugins: createPlugins() }),
			editable: () => !readOnly,
			dispatchTransaction(transaction) {
				if (!view) return;
				view.updateState(view.state.apply(transaction));
				syncSelectedBlock();
				revision += 1;
				if (transaction.docChanged && !suppressChange) {
					lastHtml = serializeHtml();
					onChange?.({
						html: lastHtml,
						json: JSON.stringify(view.state.doc.toJSON()),
						text: view.state.doc.textBetween(0, view.state.doc.content.size, "\n\n"),
					});
				}
			},
		});
		syncSelectedBlock();
		lastHtml = serializeHtml();
		return () => view?.destroy();
	});

	function createPlugins() {
		return [
			history(),
			tableEditing(),
			inputRules({
				rules: [
					textblockTypeInputRule(/^(#{1,3})\s$/, headingNode, (match) => ({
						level: match[1]!.length,
					})),
					textblockTypeInputRule(/^```$/, codeBlockNode),
					wrappingInputRule(/^\s*>\s$/, blockquoteNode),
					wrappingInputRule(/^\s*([-+*])\s$/, bulletListNode),
					wrappingInputRule(/^(\d+)\.\s$/, orderedListNode, (match) => ({
						order: Number(match[1]),
					})),
					markdownMarkInputRule(/\*\*([^*]+)\*\*$/, strongMark),
					markdownMarkInputRule(/__([^_]+)__$/, strongMark),
					markdownMarkInputRule(/(?<!\*)\*([^*]+)\*$/, emphasisMark),
					markdownMarkInputRule(/(?<!_)_([^_]+)_$/, emphasisMark),
					markdownMarkInputRule(/`([^`]+)`$/, codeMark),
				],
			}),
			keymap({
				Backspace: undoInputRule,
				"Mod-z": undo,
				"Mod-y": redo,
				"Shift-Mod-z": redo,
				"Mod-b": toggleMark(strongMark),
				"Mod-i": toggleMark(emphasisMark),
				"Mod-u": toggleMark(underlineMark),
				"Mod-Shift-8": wrapInList(bulletListNode),
				"Mod-Shift-7": wrapInList(orderedListNode),
			}),
			keymap(baseKeymap),
		];
	}

	function markdownMarkInputRule(expression: RegExp, mark: MarkType) {
		return new InputRule(expression, (state, match, start, end) => {
			const text = match[1];
			if (!text) return null;
			return state.tr
				.delete(start, end)
				.insertText(text, start)
				.addMark(start, start + text.length, mark.create())
				.removeStoredMark(mark);
		});
	}

	function parseHtml(value: string) {
		const container = document.createElement("div");
		container.innerHTML = convertAsciiTablesInHtml(value) || "<p></p>";
		return ProseMirrorDOMParser.fromSchema(schema).parse(container);
	}

	function serializeHtml() {
		if (!view) return html;
		const container = document.createElement("div");
		container.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(view.state.doc.content));
		return container.innerHTML;
	}

	function run(command: Command) {
		if (!view || readOnly) return;
		command(view.state, view.dispatch, view);
		view.focus();
		revision += 1;
	}

	function setBlock(value: string) {
		if (value === "paragraph") run(setBlockType(paragraphNode));
		else run(setBlockType(headingNode, { level: Number(value.slice(1)) }));
	}

	function syncSelectedBlock() {
		if (!view || view.state.selection.$from.parent.type !== headingNode) {
			selectedBlock = "paragraph";
			return;
		}

		const level = view.state.selection.$from.parent.attrs.level;
		selectedBlock =
			level >= 1 && level <= 3 ? (`h${level}` as BlockStyle) : "paragraph";
	}

	function markActive(markName: string) {
		revision;
		if (!view) return false;
		const mark = schema.marks[markName]!;
		const { from, to, empty } = view.state.selection;
		if (empty) return Boolean(mark.isInSet(view.state.storedMarks || view.state.selection.$from.marks()));
		return view.state.doc.rangeHasMark(from, to, mark);
	}
</script>

<div class="EditorShell" class:is-readonly={readOnly}>
	{#if !readOnly}
		<div class="EditorToolbar" aria-label="Mise en forme du contenu">
			<button class="ToolbarButton ToolbarHistoryButton" title="Annuler" onclick={() => run(undo)}>
				<IconArrowCounterClockwiseRegular class="icon" />
			</button>
			<button class="ToolbarButton ToolbarHistoryButton" title="Rétablir" onclick={() => run(redo)}>
				<IconArrowClockwiseRegular class="icon" />
			</button>
			<select
				class="select control-size-1 BlockSelect"
				bind:value={selectedBlock}
				aria-label="Style de paragraphe"
				onchange={(event) => setBlock(event.currentTarget.value)}
			>
				<option value="paragraph">Paragraphe</option>
				<option value="h1">Titre 1</option>
				<option value="h2">Titre 2</option>
				<option value="h3">Titre 3</option>
			</select>
			<span class="ToolbarSeparator"></span>
			<button class="ToolbarButton" class:active={markActive("strong")} title="Gras" onclick={() => run(toggleMark(strongMark))}>
				<IconTextBRegular class="icon" />
			</button>
			<button class="ToolbarButton" class:active={markActive("em")} title="Italique" onclick={() => run(toggleMark(emphasisMark))}>
				<IconTextItalicRegular class="icon" />
			</button>
			<button class="ToolbarButton" class:active={markActive("underline")} title="Souligné" onclick={() => run(toggleMark(underlineMark))}>
				<IconTextUnderlineRegular class="icon" />
			</button>
			<span class="ToolbarSeparator"></span>
			<button class="ToolbarButton" title="Liste à puces" onclick={() => run(wrapInList(bulletListNode))}>
				<IconListBulletsRegular class="icon" />
			</button>
			<button class="ToolbarButton" title="Liste numérotée" onclick={() => run(wrapInList(orderedListNode))}>
				<IconListNumbersRegular class="icon" />
			</button>
		</div>
	{/if}
	<div class="EditorSurface" bind:this={mount}></div>
</div>

<style>
	.EditorShell {
		display: flex;
		flex-direction: column;
		min-height: 100%;
		background: var(--color-base-100);
	}

	.EditorToolbar {
		position: sticky;
		top: var(--content-editor-topbar-height, 3.25rem);
		z-index: 5;
		min-height: 3.25rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.45rem 0.65rem;
		background: rgba(255, 255, 255, 0.96);
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.03);
	}

	.ToolbarButton {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.ToolbarButton:hover:not(:disabled),
	.ToolbarButton.active {
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	.ToolbarButton:disabled { opacity: 0.35; }
	.ToolbarHistoryButton :global(.icon) { font-size: calc(1.5em - 4px); }
	.ToolbarSeparator { width: 1px; height: 1.5rem; background: var(--color-border); margin: 0 0.25rem; }
	.BlockSelect { width: 9rem; border: 0; border-radius: 0.5rem; cursor: pointer; }
	.BlockSelect:hover {
		background-color: var(--color-primary-light);
		color: var(--color-base-content);
	}
	.EditorSurface {
		flex: 1;
		padding: 1.5rem 0.5rem 6rem;
	}

	.EditorSurface :global(.ProseMirror) {
		min-height: 70dvh;
		outline: none;
		font-size: 1.12rem;
		line-height: 1.62;
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.EditorSurface :global(.ProseMirror h1) { font-size: 2.55rem; line-height: 1.15; font-weight: 750; margin: 0.75rem 0 1rem; }
	.EditorSurface :global(.ProseMirror h2) { font-size: 2rem; line-height: 1.2; font-weight: 720; margin: 2rem 0 0.75rem; }
	.EditorSurface :global(.ProseMirror h3) { font-size: 1.5rem; line-height: 1.25; font-weight: 700; margin: 1.5rem 0 0.5rem; }
	.EditorSurface :global(.ProseMirror p) { margin: 0.75rem 0; }
	.EditorSurface :global(.ProseMirror ul),
	.EditorSurface :global(.ProseMirror ol) { padding-left: 1.75rem; margin: 0.75rem 0; }
	.EditorSurface :global(.ProseMirror ul) { list-style: disc; }
	.EditorSurface :global(.ProseMirror ol) { list-style: decimal; }
	.EditorSurface :global(.ProseMirror blockquote) { border-left: 3px solid var(--color-primary); padding-left: 1rem; color: var(--color-text-light); }
	.EditorSurface :global(.ProseMirror pre) { margin: 1rem 0; padding: 1rem; border-radius: 0.65rem; background: #17141d; color: white; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
	.EditorSurface :global(.ProseMirror code) { padding: 0.1rem 0.3rem; border-radius: 0.3rem; background: #f1eef7; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
	.EditorSurface :global(.ProseMirror pre code) { padding: 0; background: transparent; }
	.EditorSurface :global(.ProseMirror table) { width: 100%; margin: 1.25rem 0; border-collapse: collapse; table-layout: fixed; }
	.EditorSurface :global(.ProseMirror th),
	.EditorSurface :global(.ProseMirror td) { min-width: 5rem; padding: 0.65rem 0.75rem; border: 1px solid var(--color-border); vertical-align: top; text-align: left; }
	.EditorSurface :global(.ProseMirror th) { color: var(--color-base-content); background: var(--color-base-300); font-weight: 700; }
	.EditorSurface :global(.ProseMirror td) { background: var(--color-base-100); }
	.EditorSurface :global(.ProseMirror th p),
	.EditorSurface :global(.ProseMirror td p) { margin: 0; }
	.EditorSurface :global(.ProseMirror .selectedCell) { position: relative; }
	.EditorSurface :global(.ProseMirror .selectedCell::after) { position: absolute; inset: 0; pointer-events: none; content: ""; background: rgb(139 69 255 / 12%); }
	.EditorSurface :global(.ProseMirror img) { max-width: 100%; border-radius: 0.75rem; }
	.is-readonly .EditorSurface :global(.ProseMirror) { color: #505050; }
</style>

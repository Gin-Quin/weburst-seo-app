<script lang="ts">
	import { convertAsciiTablesInHtml } from "$lib/contents/articleHtml";
	import { setListType } from "$lib/contents/editorLists";
	import type { SerpmanticsGuide } from "$lib/server/serpmantics";
	import {
		autoUpdate,
		computePosition,
		flip,
		inline,
		offset,
		shift,
		type VirtualElement,
	} from "@floating-ui/dom";
	import { onMount, tick } from "svelte";
	import { Schema, DOMParser as ProseMirrorDOMParser, DOMSerializer, type MarkSpec, type MarkType, type Node as ProseMirrorNode } from "prosemirror-model";
	import { EditorState, Plugin, PluginKey, TextSelection, type Command } from "prosemirror-state";
	import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
	import { schema as basicSchema } from "prosemirror-schema-basic";
	import { addListNodes } from "prosemirror-schema-list";
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
	import IconArrowUpRegular from "phosphor-icons-svelte/IconArrowUpRegular.svelte";
	import { toast } from "svelte-sonner";
	import ArticleChangesDialog from "./ArticleChangesDialog.svelte";
	import RewriteLoadingDialog from "./RewriteLoadingDialog.svelte";

	let {
		html,
		projectId,
		contentId,
		guide,
		readOnly = false,
		onChange,
		setEditorContent = $bindable(),
	}: {
		html: string;
		projectId: string;
		contentId: string;
		guide: SerpmanticsGuide | null;
		readOnly?: boolean;
		onChange?: (value: { html: string; json: string; text: string }) => void;
		setEditorContent?: (html: string) => EditorContent | undefined;
	} = $props();
	type EditorContent = { html: string; json: string; text: string };
	type BlockStyle = "paragraph" | "h1" | "h2" | "h3";
	type RewriteSelection = {
		from: number;
		to: number;
		blockFrom: number;
		blockTo: number;
		selectedText: string;
		selectedHtml: string;
		currentHtml: string;
		range: Range;
	};
	type RewriteProposal = Omit<RewriteSelection, "range"> & {
		proposedHtml: string;
		deletesSelection: boolean;
	};
	type RewriteHighlight = { from: number; to: number } | null;
	const REWRITE_BUBBLE_DELAY_MS = 300;
	const rewriteHighlightKey = new PluginKey<DecorationSet>("rewrite-selection-highlight");

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
	const listItemNode = schema.nodes.list_item!;

	let mount: HTMLDivElement;
	let view: EditorView | undefined;
	let suppressChange = false;
	let lastHtml = html;
	let revision = $state(0);
	let selectedBlock = $state<BlockStyle>("paragraph");
	let bubbleMenu = $state<HTMLFormElement>();
	let bubbleVisible = $state(false);
	let rewriteInstruction = $state("");
	let rewriteLoading = $state(false);
	let acceptingRewrite = $state(false);
	let rewriteSelection = $state<RewriteSelection | undefined>();
	let rewriteProposal = $state<RewriteProposal | undefined>();
	let cleanupFloating: (() => void) | undefined;
	let positionFrame: number | undefined;
	let rewriteBubbleTimeout: ReturnType<typeof setTimeout> | undefined;

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
				if (transaction.getMeta(rewriteHighlightKey) === undefined) scheduleRewriteBubble();
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
		scheduleRewriteBubble();
		return () => {
			cleanupFloating?.();
			clearTimeout(rewriteBubbleTimeout);
			if (positionFrame !== undefined) cancelAnimationFrame(positionFrame);
			view?.destroy();
		};
	});

	function createPlugins() {
		return [
			new Plugin<DecorationSet>({
				key: rewriteHighlightKey,
				state: {
					init: () => DecorationSet.empty,
					apply(transaction, decorations) {
						const highlight = transaction.getMeta(rewriteHighlightKey) as
							| RewriteHighlight
							| undefined;
						if (highlight === null) return DecorationSet.empty;
						if (highlight) return createRewriteHighlight(transaction.doc, highlight);
						return decorations.map(transaction.mapping, transaction.doc);
					},
				},
				props: {
					decorations: (state) => rewriteHighlightKey.getState(state),
				},
			}),
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
				"Mod-Shift-8": setListType(bulletListNode, listItemNode),
				"Mod-Shift-7": setListType(orderedListNode, listItemNode),
			}),
			keymap(baseKeymap),
		];
	}

	function createRewriteHighlight(doc: ProseMirrorNode, highlight: Exclude<RewriteHighlight, null>) {
		const decorations: Decoration[] = [];
		doc.nodesBetween(highlight.from, highlight.to, (node, position) => {
			if (!node.isText) return;
			const from = Math.max(highlight.from, position);
			const to = Math.min(highlight.to, position + node.nodeSize);
			if (from < to) decorations.push(Decoration.inline(from, to, { class: "RewriteSelection" }));
		});
		return DecorationSet.create(doc, decorations);
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

	function serializeFragment(from: number, to: number) {
		if (!view) return "";
		const container = document.createElement("div");
		container.appendChild(
			DOMSerializer.fromSchema(schema).serializeFragment(view.state.doc.slice(from, to).content),
		);
		return container.innerHTML;
	}

	function scheduleRewriteBubble() {
		hideRewriteBubble();
		clearTimeout(rewriteBubbleTimeout);
		if (positionFrame !== undefined) cancelAnimationFrame(positionFrame);
		rewriteBubbleTimeout = setTimeout(() => {
			rewriteBubbleTimeout = undefined;
			positionFrame = requestAnimationFrame(() => {
				positionFrame = undefined;
				void syncRewriteBubble();
			});
		}, REWRITE_BUBBLE_DELAY_MS);
	}

	async function syncRewriteBubble() {
		if (!view || readOnly || rewriteLoading || rewriteProposal) {
			hideRewriteBubble();
			return;
		}

		const { selection } = view.state;
		if (!(selection instanceof TextSelection) || selection.empty) {
			hideRewriteBubble();
			return;
		}

		const browserSelection = window.getSelection();
		if (!browserSelection?.rangeCount) {
			hideRewriteBubble();
			return;
		}
		const range = browserSelection.getRangeAt(0);
		if (!view.dom.contains(range.commonAncestorContainer)) {
			hideRewriteBubble();
			return;
		}

		let blockFrom: number | undefined;
		let blockTo: number | undefined;
		view.state.doc.nodesBetween(selection.from, selection.to, (node, position, parent) => {
			if (parent !== view?.state.doc) return;
			blockFrom ??= position;
			blockTo = position + node.nodeSize;
			return false;
		});
		if (blockFrom === undefined || blockTo === undefined) {
			hideRewriteBubble();
			return;
		}
		const selectedText = view.state.doc.textBetween(selection.from, selection.to, "\n");
		if (!selectedText.trim()) {
			hideRewriteBubble();
			return;
		}

		rewriteSelection = {
			from: selection.from,
			to: selection.to,
			blockFrom,
			blockTo,
			selectedText,
			selectedHtml: serializeFragment(selection.from, selection.to),
			currentHtml: serializeFragment(blockFrom, blockTo),
			range: range.cloneRange(),
		};
		bubbleVisible = true;
		await positionRewriteBubble(rewriteSelection.range);
	}

	async function positionRewriteBubble(range: Range) {
		await tick();
		const floatingElement = bubbleMenu;
		if (!bubbleVisible || !floatingElement || !view) return;
		cleanupFloating?.();
		const reference: VirtualElement = {
			getBoundingClientRect: () => range.getBoundingClientRect(),
			getClientRects: () => range.getClientRects(),
			contextElement: view.dom,
		};
		const update = async () => {
			const position = await computePosition(reference, floatingElement, {
				strategy: "fixed",
				placement: "top",
				middleware: [inline(), offset(10), flip({ fallbackPlacements: ["bottom"] }), shift({ padding: 12 })],
			});
			Object.assign(floatingElement.style, {
				left: `${position.x}px`,
				top: `${position.y}px`,
			});
		};
		cleanupFloating = autoUpdate(reference, floatingElement, () => void update());
		await update();
	}

	function hideRewriteBubble() {
		bubbleVisible = false;
		clearTimeout(rewriteBubbleTimeout);
		rewriteBubbleTimeout = undefined;
		cleanupFloating?.();
		cleanupFloating = undefined;
	}

	function showRewriteHighlight() {
		if (!view || !rewriteSelection) return;
		view.dispatch(
			view.state.tr.setMeta(rewriteHighlightKey, {
				from: rewriteSelection.from,
				to: rewriteSelection.to,
			} satisfies Exclude<RewriteHighlight, null>),
		);
	}

	function clearRewriteHighlight() {
		if (!view || rewriteHighlightKey.getState(view.state) === DecorationSet.empty) return;
		view.dispatch(view.state.tr.setMeta(rewriteHighlightKey, null satisfies RewriteHighlight));
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (!bubbleVisible || !(event.target instanceof Node)) return;
		if (bubbleMenu?.contains(event.target) || view?.dom.contains(event.target)) return;
		hideRewriteBubble();
		clearRewriteHighlight();
	}

	async function requestRewrite(event: SubmitEvent) {
		event.preventDefault();
		const instruction = rewriteInstruction.trim();
		if (!rewriteSelection || rewriteLoading || !instruction) return;
		const selection = rewriteSelection;
		hideRewriteBubble();
		clearRewriteHighlight();
		rewriteLoading = true;
		try {
			const response = await fetch("/api/contents/rewrite-selection", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectId,
					contentId,
					instruction,
					selectedText: selection.selectedText,
					fragmentHtml: selection.currentHtml,
				}),
			});
			if (!response.ok) throw new Error((await response.text()) || "La réécriture a échoué.");
			const result = (await response.json()) as { html?: unknown };
			if (typeof result.html !== "string") throw new Error("La réponse de réécriture est invalide.");
			const deletesSelection = result.html.trim() === "";
			rewriteProposal = {
				...selection,
				currentHtml: deletesSelection ? selection.selectedHtml : selection.currentHtml,
				proposedHtml: result.html,
				deletesSelection,
			};
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "La réécriture a échoué.", {
				richColors: true,
			});
			restoreRewriteSelection(selection);
		} finally {
			rewriteLoading = false;
		}
	}

	function restoreRewriteSelection(selection: Pick<RewriteSelection, "from" | "to">) {
		if (!view || selection.to > view.state.doc.content.size) return;
		view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, selection.from, selection.to)));
		view.focus();
	}

	function cancelRewrite() {
		if (!rewriteProposal || acceptingRewrite) return;
		const position = Math.min(rewriteProposal.from, view?.state.doc.content.size ?? 0);
		rewriteProposal = undefined;
		rewriteInstruction = "";
		if (view) {
			view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(position))));
			view.focus();
		}
	}

	async function acceptRewrite(afterHtml: string) {
		if (!view || !rewriteProposal || acceptingRewrite) return;
		acceptingRewrite = true;
		try {
			if (rewriteProposal.to > view.state.doc.content.size) {
				throw new Error("Le passage a changé depuis la proposition. Relancez la réécriture.");
			}
			if (rewriteProposal.deletesSelection) {
				view.dispatch(
					view.state.tr.delete(rewriteProposal.from, rewriteProposal.to).scrollIntoView(),
				);
			} else {
				if (rewriteProposal.blockTo > view.state.doc.content.size) {
					throw new Error("Le passage a changé depuis la proposition. Relancez la réécriture.");
				}
				const replacement = parseHtml(afterHtml).content;
				view.dispatch(
					view.state.tr
						.replaceWith(rewriteProposal.blockFrom, rewriteProposal.blockTo, replacement)
						.scrollIntoView(),
				);
			}
			rewriteProposal = undefined;
			rewriteInstruction = "";
			view.focus();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Impossible d’appliquer la réécriture.", {
				richColors: true,
			});
		} finally {
			acceptingRewrite = false;
		}
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

<svelte:window onpointerdown={handleWindowPointerDown} />

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
			<button class="ToolbarButton" title="Liste à puces" onclick={() => run(setListType(bulletListNode, listItemNode))}>
				<IconListBulletsRegular class="icon" />
			</button>
			<button class="ToolbarButton" title="Liste numérotée" onclick={() => run(setListType(orderedListNode, listItemNode))}>
				<IconListNumbersRegular class="icon" />
			</button>
		</div>
	{/if}
	<div class="EditorSurface" bind:this={mount}></div>
</div>

{#if bubbleVisible}
	<form class="RewriteBubble" bind:this={bubbleMenu} onsubmit={requestRewrite} aria-label="Réécrire le passage sélectionné">
		<input
			type="text"
			bind:value={rewriteInstruction}
			placeholder="Que souhaitez-vous modifier ?"
			aria-label="Consigne de réécriture"
			onfocus={showRewriteHighlight}
			onblur={clearRewriteHighlight}
			onkeydown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					hideRewriteBubble();
					view?.focus();
				}
			}}
		/>
		<button type="submit" aria-label="Lancer la réécriture" disabled={!rewriteInstruction.trim()}>
			<IconArrowUpRegular class="icon" />
		</button>
	</form>
{/if}

{#if rewriteLoading}
	<RewriteLoadingDialog />
{:else if rewriteProposal}
	<ArticleChangesDialog
		currentHtml={rewriteProposal.currentHtml}
		proposedHtml={rewriteProposal.proposedHtml}
		{guide}
		showScores={false}
		cancelLabel="Refuser les modifications"
		acceptLabel="Appliquer les modifications"
		accepting={acceptingRewrite}
		onAccept={acceptRewrite}
		onCancel={cancelRewrite}
	/>
{/if}

<style>
	.EditorShell {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
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
		display: flex;
		padding: 1.5rem 0.5rem 6rem;
	}

	.EditorSurface :global(.ProseMirror) {
		flex: 1;
		min-height: 0;
		outline: none;
		font-size: 1.12rem;
		line-height: 1.62;
		white-space: pre-wrap;
		word-wrap: break-word;
	}
	.EditorSurface :global(.ProseMirror ::selection) { background: #e8d9ff; }
	.EditorSurface :global(.ProseMirror .RewriteSelection) {
		background: #e8d9ff;
		border-radius: 0.2rem;
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
	.EditorSurface :global(.ProseMirror hr) { margin-block: 2rem; border-color: var(--color-gray-300); }
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

	.RewriteBubble {
		position: fixed;
		z-index: 40;
		width: min(32rem, calc(100vw - 1.5rem));
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.55rem 0.65rem 0.55rem 1rem;
		background: #fbf9fd;
		border: 1px solid #ece8ef;
		border-radius: 0.75rem;
		box-shadow: 0 5px 20px rgb(35 23 51 / 18%);
	}

	.RewriteBubble input {
		min-width: 0;
		flex: 1;
		border: 0;
		outline: none;
		background: transparent;
		color: var(--color-base-content);
		font-size: 1rem;
		line-height: 1.4;
	}

	.RewriteBubble input::placeholder { color: var(--color-text-light); opacity: 1; }

	.RewriteBubble button {
		flex: 0 0 auto;
		width: 2.4rem;
		height: 2.4rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: white;
		background: var(--color-primary);
		border-radius: 0.4rem;
		cursor: pointer;
	}

	.RewriteBubble button:hover:not(:disabled) { background: #7a32f3; }
	.RewriteBubble button:disabled { opacity: 0.5; cursor: default; }
	.RewriteBubble button :global(.icon) { width: 1.45rem; height: 1.45rem; }
</style>

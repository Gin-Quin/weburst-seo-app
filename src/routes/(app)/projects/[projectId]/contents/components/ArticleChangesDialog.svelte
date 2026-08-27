<script lang="ts">
	import { diffSequence, type DiffState } from "$lib/contents/articleDiff";
	import { convertAsciiTablesInHtml } from "$lib/contents/articleHtml";
	import { analyzeOptimizationContent } from "$lib/contents/optimization";
	import OptimizationScore from "$lib/components/OptimizationScore.svelte";
	import type { SerpmanticsGuide } from "$lib/server/serpmantics";
	import DOMPurify from "dompurify";
	import { marked } from "marked";
	import IconXRegular from "phosphor-icons-svelte/IconXRegular.svelte";

	let {
		currentHtml,
		proposedMarkdown,
		guide,
		accepting = false,
		onAccept,
		onCancel,
	}: {
		currentHtml: string;
		proposedMarkdown: string;
		guide: SerpmanticsGuide | null;
		accepting?: boolean;
		onAccept: (html: string) => void | Promise<void>;
		onCancel: () => void;
	} = $props();

	const comparison = $derived.by(() => buildComparison(currentHtml, proposedMarkdown, guide));

	function buildComparison(
		beforeHtml: string,
		markdown: string,
		serpmanticsGuide: SerpmanticsGuide | null,
	) {
		const afterHtml = DOMPurify.sanitize(
			convertAsciiTablesInHtml(marked.parse(markdown, { async: false }) as string),
		);
		const beforeBlocks = getArticleBlocks(beforeHtml);
		const afterBlocks = getArticleBlocks(afterHtml);
		const states = diffSequence(
			beforeBlocks.map((block) => block.html),
			afterBlocks.map((block) => block.html),
		);

		return {
			afterHtml,
			beforeDiffHtml: renderBlocks(beforeBlocks, states.before),
			afterDiffHtml: renderBlocks(afterBlocks, states.after),
			beforeScore: analyzeOptimizationContent(
				{ html: beforeHtml, text: htmlToText(beforeHtml) },
				serpmanticsGuide,
			).score,
			afterScore: analyzeOptimizationContent(
				{ html: afterHtml, text: htmlToText(afterHtml) },
				serpmanticsGuide,
			).score,
		};
	}

	function getArticleBlocks(html: string) {
		const document = new DOMParser().parseFromString(`<body>${DOMPurify.sanitize(html)}</body>`, "text/html");
		return Array.from(document.body.childNodes)
			.filter((node) => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim())
			.map((node) => {
				if (node instanceof HTMLElement) return { html: node.outerHTML };
				const paragraph = document.createElement("p");
				paragraph.textContent = node.textContent ?? "";
				return { html: paragraph.outerHTML };
			});
	}

	function renderBlocks(blocks: { html: string }[], states: DiffState[]) {
		return DOMPurify.sanitize(
			blocks
				.map((block, index) => {
					const state = states[index];
					if (state === "unchanged") return block.html;
					return `<div class="DiffHighlight ${state === "added" ? "DiffAdded" : "DiffRemoved"}">${block.html}</div>`;
				})
				.join(""),
		);
	}

	function htmlToText(html: string) {
		const document = new DOMParser().parseFromString(html, "text/html");
		return document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
	}

	function handleBackdrop(event: MouseEvent) {
		if (!accepting && event.target === event.currentTarget) onCancel();
	}
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && !accepting && onCancel()} />

<div class="DialogBackdrop" role="presentation" onclick={handleBackdrop}>
	<dialog open class="ChangesDialog" aria-modal="true" aria-labelledby="changes-dialog-title">
		<header class="DialogHeader">
			<h2 id="changes-dialog-title">Modifications apportées</h2>
			<button class="CloseButton" type="button" aria-label="Fermer" disabled={accepting} onclick={onCancel}>
				<IconXRegular class="icon" />
			</button>
		</header>

		<div class="ComparisonHeadings">
			<div><strong>Version actuelle</strong><OptimizationScore score={comparison.beforeScore} size="regular" /></div>
			<div><strong>Nouvelle version</strong><OptimizationScore score={comparison.afterScore} size="regular" /></div>
		</div>

		<div class="ComparisonColumns">
			<article class="ArticleCard CurrentArticle" aria-label="Version actuelle">
				<div class="ArticleBody">{@html comparison.beforeDiffHtml}</div>
			</article>
			<article class="ArticleCard ProposedArticle" aria-label="Nouvelle version">
				<div class="ArticleBody">{@html comparison.afterDiffHtml}</div>
			</article>
		</div>

		<footer class="DialogActions">
			<button class="btn SecondaryAction" type="button" disabled={accepting} onclick={onCancel}>Annuler les propositions</button>
			<button class="btn PrimaryAction" type="button" disabled={accepting} onclick={() => void onAccept(comparison.afterHtml)}>
				{accepting ? "Application…" : "Accepter l’article"}
			</button>
		</footer>
	</dialog>
</div>

<style>
	.DialogBackdrop { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 1.5rem; background: rgb(38 32 48 / 24%); backdrop-filter: blur(1px); }
	.ChangesDialog { width: min(1080px, calc(100vw - 3rem)); max-height: calc(100dvh - 3rem); padding: 1.5rem 1.75rem 1.7rem; overflow: hidden; background: white; border: 1px solid rgb(229 226 234); border-radius: 1.75rem; box-shadow: 0 24px 70px rgb(28 17 49 / 18%); display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; }
	.DialogHeader { position: relative; min-height: 3.2rem; display: flex; align-items: flex-start; justify-content: center; }
	.DialogHeader h2 { margin: 0; color: #0e0c10; font-size: clamp(1.55rem, 2.5vw, 2rem); line-height: 1.2; font-weight: 750; letter-spacing: -0.03em; text-align: center; }
	.CloseButton { position: absolute; top: -0.1rem; right: 0; width: 2.5rem; height: 2.5rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; color: #111; cursor: pointer; }
	.CloseButton:hover { background: #f3f0f6; }
	.CloseButton:disabled { opacity: 0.45; cursor: default; }
	.CloseButton :global(.icon) { width: 2rem; height: 2rem; }
	.ComparisonHeadings { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1.15rem; margin: 0.4rem 0 0.75rem; }
	.ComparisonHeadings > div { display: flex; align-items: center; justify-content: center; gap: 0.65rem; color: #291451; font-size: 1.25rem; }
	.ComparisonHeadings strong { font-weight: 700; }
	.ComparisonColumns { min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1.15rem; overflow: hidden; }
	.ArticleCard { min-width: 0; min-height: 20rem; padding: 1.4rem; overflow-x: hidden; overflow-y: auto; border: 1px solid #e8e5eb; border-radius: 1.15rem; }
	.CurrentArticle { background: #fff; }
	.ProposedArticle { background: #fbf8ff; }
	.ArticleBody { min-width: 0; color: #2f1b59; font-size: 1rem; line-height: 1.48; }
	.ArticleBody :global(h1), .ArticleBody :global(h2), .ArticleBody :global(h3), .ArticleBody :global(h4) { margin: 0.9rem 0 0.35rem; color: #111; font-weight: 750; line-height: 1.3; }
	.ArticleBody :global(h1:first-child), .ArticleBody :global(h2:first-child), .ArticleBody :global(h3:first-child), .ArticleBody :global(p:first-child) { margin-top: 0; }
	.ArticleBody :global(h1) { font-size: 1.45rem; }
	.ArticleBody :global(h2) { font-size: 1.3rem; }
	.ArticleBody :global(h3) { font-size: 1.15rem; }
	.ArticleBody :global(p) { margin: 0 0 0.55rem; }
	.ArticleBody :global(ul), .ArticleBody :global(ol) { margin: 0.45rem 0; padding-left: 1.4rem; }
	.ArticleBody :global(ul) { list-style: disc; }
	.ArticleBody :global(ol) { list-style: decimal; }
	.ArticleBody :global(img) { display: block; width: 100%; height: auto; margin: 1.1rem 0 0.35rem; object-fit: cover; }
	.ArticleBody :global(a) { color: var(--color-primary); text-decoration: underline; }
	.ArticleBody :global(pre) { display: block; width: 100%; min-width: 0; max-width: 100%; margin-inline: 0; overflow-x: auto; overscroll-behavior-inline: contain; background: transparent; box-sizing: border-box; }
	.ArticleBody :global(pre code) { display: block; width: max-content; min-width: 100%; background: transparent; }
	.ArticleBody :global(table) { width: 100%; margin: 0.75rem 0; border-collapse: collapse; table-layout: fixed; }
	.ArticleBody :global(th), .ArticleBody :global(td) { padding: 0.5rem 0.6rem; border: 1px solid #dcd7e4; vertical-align: top; text-align: left; overflow-wrap: anywhere; }
	.ArticleBody :global(th) { color: #21133d; background: rgb(255 255 255 / 55%); font-weight: 700; }
	.ArticleBody :global(td) { background: rgb(255 255 255 / 28%); }
	.ArticleBody :global(th p), .ArticleBody :global(td p) { margin: 0; }
	.ArticleBody :global(.DiffHighlight) { min-width: 0; max-width: calc(100% + 0.9rem); margin: 0 -0.45rem 0.45rem; padding: 0.15rem 0.45rem 0.01rem; overflow: hidden; border-radius: 0.55rem; box-sizing: border-box; }
	.ArticleBody :global(.DiffHighlight > :first-child) { margin-top: 0; }
	.ArticleBody :global(.DiffHighlight > :last-child) { margin-bottom: 0; }
	.ArticleBody :global(.DiffAdded) { background: #d9ffdf; }
	.ArticleBody :global(.DiffRemoved) { background: #ffe0e0; text-decoration-color: #d24848; }
	.DialogActions { display: flex; justify-content: center; gap: 0.75rem; padding-top: 1.55rem; }
	.DialogActions .btn { min-width: 16.5rem; min-height: 3.5rem; padding-inline: 1.5rem; border-radius: 0.65rem; font-size: 1rem; font-weight: 700; }
	.SecondaryAction { color: #17131c; background: white; border: 1px solid #908a96; }
	.PrimaryAction { color: white; background: #8b45ff; border-color: #8b45ff; }
	.PrimaryAction:hover { background: #7a32f3; border-color: #7a32f3; }
	.DialogActions .btn:disabled { opacity: 0.55; }
	@media (max-width: 760px) {
		.DialogBackdrop { padding: 0.65rem; }
		.ChangesDialog { width: calc(100vw - 1.3rem); max-height: calc(100dvh - 1.3rem); padding: 1rem; border-radius: 1.2rem; overflow-y: auto; display: block; }
		.DialogHeader { min-height: 3.4rem; padding-inline: 2.2rem; }
		.ComparisonHeadings, .ComparisonColumns { grid-template-columns: 1fr; }
		.ComparisonHeadings { display: none; }
		.ComparisonColumns { overflow: visible; }
		.ArticleCard::before { display: block; margin-bottom: 0.75rem; color: #291451; font-size: 1.1rem; font-weight: 700; text-align: center; }
		.CurrentArticle::before { content: "Version actuelle"; }
		.ProposedArticle::before { content: "Nouvelle version"; }
		.ArticleCard { min-height: auto; max-height: none; overflow-x: hidden; overflow-y: visible; }
		.DialogActions { flex-direction: column-reverse; }
		.DialogActions .btn { width: 100%; min-width: 0; }
	}
</style>

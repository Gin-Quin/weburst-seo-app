<script lang="ts">
	import { goto } from "$app/navigation";
	import type { ContentDetail, ContentVersionDetail } from "$lib/server/contents";
	import IconArrowLeftRegular from "phosphor-icons-svelte/IconArrowLeftRegular.svelte";
	import IconChatCircleDotsRegular from "phosphor-icons-svelte/IconChatCircleDotsRegular.svelte";
	import IconClockCounterClockwiseRegular from "phosphor-icons-svelte/IconClockCounterClockwiseRegular.svelte";
	import IconFloppyDiskRegular from "phosphor-icons-svelte/IconFloppyDiskRegular.svelte";
	import IconNotepadRegular from "phosphor-icons-svelte/IconNotepadRegular.svelte";
	import IconTrendUpRegular from "phosphor-icons-svelte/IconTrendUpRegular.svelte";
	import { onDestroy } from "svelte";
	import { toast } from "svelte-sonner";
	import {
		getContent,
		refreshOptimization,
		saveDraft,
	} from "../../../../../api/contents/contents.remote";
	import BriefPanel from "./BriefPanel.svelte";
	import ChatPanel from "./ChatPanel.svelte";
	import OptimizationPanel from "./OptimizationPanel.svelte";
	import ProseMirrorEditor from "./ProseMirrorEditor.svelte";
	import VersionsPanel from "./VersionsPanel.svelte";

	type Tab = "brief" | "optimization" | "chat" | "versions";

	let { initialContent }: { initialContent: ContentDetail } = $props();
	let content = $state(initialContent);
	let activeTab = $state<Tab>("brief");
	let draftHtml = $state(initialContent.contentHtml);
	let draftJson = $state(initialContent.contentJson);
	let dirty = $state(false);
	let saving = $state(false);
	let draftRevision = 0;
	let savePromise: Promise<void> | undefined;
	let lastSavedAt = $state(initialContent.updatedAt);
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;
	let optimizationTimeout: ReturnType<typeof setTimeout> | undefined;
	let optimizationDraft = $state<{ html: string; text: string } | undefined>();
	let previewedVersion = $state<ContentVersionDetail | undefined>();
	let setEditorContent = $state<
		((html: string) => { html: string; json: string; text: string } | undefined) | undefined
	>();
	let sendChatPrompt = $state<((prompt: string) => void) | undefined>();

	function editorChanged(value: { html: string; json: string; text: string }) {
		if (previewedVersion) return;
		draftHtml = value.html;
		draftJson = value.json;
		draftRevision += 1;
		dirty = true;
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => void saveNow().catch(() => undefined), 900);
		scheduleOptimizationUpdate({ html: value.html, text: value.text });
	}

	function scheduleOptimizationUpdate(value: { html: string; text: string }) {
		clearTimeout(optimizationTimeout);
		optimizationTimeout = setTimeout(() => {
			optimizationDraft = value;
		}, 600);
	}

	onDestroy(() => {
		clearTimeout(saveTimeout);
		clearTimeout(optimizationTimeout);
	});

	async function saveNow() {
		if (previewedVersion) return;
		if (savePromise) {
			await savePromise;
			if (dirty) await saveNow();
			return;
		}
		if (!dirty) return;

		const revision = draftRevision;
		const contentHtml = draftHtml;
		const contentJson = draftJson;
		saving = true;
		const operation = (async () => {
			try {
				const updated = await saveDraft({
					id: content.id,
					projectId: content.projectId,
					contentHtml,
					contentJson,
				});
				content = updated;
				if (draftRevision === revision) dirty = false;
				lastSavedAt = updated.updatedAt;
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Enregistrement impossible.", { richColors: true });
				throw error;
			} finally {
				saving = false;
				savePromise = undefined;
			}
		})();
		savePromise = operation;
		await operation;
		if (dirty && draftRevision !== revision) await saveNow();
	}

	function updateContent(updated: ContentDetail) {
		content = updated;
		lastSavedAt = updated.updatedAt;
	}

	function previewVersion(version: ContentVersionDetail) {
		previewedVersion = version;
		setEditorContent?.(version.contentHtml);
	}

	function returnToCurrent() {
		previewedVersion = undefined;
		setEditorContent?.(draftHtml);
	}

	function restored(updated: ContentDetail) {
		content = updated;
		draftHtml = updated.contentHtml;
		draftJson = updated.contentJson;
		dirty = false;
		optimizationDraft = undefined;
		previewedVersion = undefined;
		setEditorContent?.(updated.contentHtml);
	}

	async function reloadAfterChat() {
		const query = getContent({ id: content.id, projectId: content.projectId });
		await query.refresh();
		const updated = await query;
		const articleChanged = updated.contentHtml !== draftHtml;
		content = updated;
		if (articleChanged) {
			draftHtml = updated.contentHtml;
			draftJson = updated.contentJson;
			dirty = false;
			previewedVersion = undefined;
			setEditorContent?.(updated.contentHtml);
			scheduleOptimizationUpdate({ html: updated.contentHtml, text: updated.contentText });
		}
	}

	async function acceptArticleProposal(html: string) {
		if (previewedVersion) return;
		const nextContent = setEditorContent?.(html);
		if (!nextContent) throw new Error("L’éditeur n’est pas encore prêt.");
		clearTimeout(saveTimeout);
		draftHtml = nextContent.html;
		draftJson = nextContent.json;
		draftRevision += 1;
		dirty = true;
		optimizationDraft = { html: nextContent.html, text: nextContent.text };
		await saveNow();
		await refreshAcceptedArticleOptimization();
	}

	async function refreshAcceptedArticleOptimization() {
		if (!content.serpmanticsGuideId) return;
		try {
			const updated = await refreshOptimization({
				id: content.id,
				projectId: content.projectId,
			});
			updateContent(updated);
			if (updated.serpmanticsStatus === "ready" && updated.serpmanticsAnalysis) {
				optimizationDraft = undefined;
			}
		} catch {
			toast.info(
				"Article enregistré. L’analyse SEO sera actualisée à la prochaine ouverture de l’onglet Optimisation.",
				{ richColors: true },
			);
		}
	}

	function optimizeWithAi(prompt: string) {
		activeTab = "chat";
		setTimeout(() => sendChatPrompt?.(prompt), 0);
	}

	async function goBack() {
		try {
			await saveNow();
			await goto(`/projects/${content.projectId}/contents`);
		} catch {
			// saveNow already surfaces the error and keeps the editor open.
		}
	}

	function savedLabel() {
		if (saving) return "Enregistrement…";
		if (dirty) return "Modifications en attente";
		return `Enregistré à ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(lastSavedAt)}`;
	}
</script>

<div class="EditorWorkspace">
	<section class="ArticleColumn">
		<div class="ArticleTopbar">
			<button class="BackButton control-size-1" onclick={() => void goBack()}><IconArrowLeftRegular class="icon" /> Contenus</button>
			<div class="SaveState"><IconFloppyDiskRegular class="icon" /> {savedLabel()}</div>
		</div>
		{#if previewedVersion}
			<div class="PreviewBar">Vous consultez la version {previewedVersion.version} en lecture seule.<button onclick={returnToCurrent}>Revenir à la version actuelle</button></div>
		{/if}
		<div class="EditorContainer">
			<ProseMirrorEditor html={draftHtml} readOnly={Boolean(previewedVersion)} onChange={editorChanged} bind:setEditorContent />
		</div>
	</section>

	<aside class="SidePanel">
		<nav class="PanelTabs">
			<button class:active={activeTab === "brief"} onclick={() => (activeTab = "brief")}><IconNotepadRegular class="icon" /> Brief</button>
			<button class:active={activeTab === "optimization"} onclick={() => (activeTab = "optimization")}><IconTrendUpRegular class="icon" /> Optimisation</button>
			<button class:active={activeTab === "chat"} onclick={() => (activeTab = "chat")}><IconChatCircleDotsRegular class="icon" /> Chat</button>
			<button class:active={activeTab === "versions"} onclick={() => (activeTab = "versions")}><IconClockCounterClockwiseRegular class="icon" /> Versions</button>
		</nav>

		<div class="PanelContent" class:chat={activeTab === "chat"}>
			{#if activeTab === "brief"}
				<BriefPanel {content} onContentUpdated={updateContent} />
			{:else if activeTab === "optimization"}
				<OptimizationPanel {content} draft={optimizationDraft} onContentUpdated={updateContent} onOptimizeWithAi={optimizeWithAi} />
			{:else if activeTab === "chat"}
				<ChatPanel {content} onBeforeSend={saveNow} onConversationFinished={reloadAfterChat} onArticleAccepted={acceptArticleProposal} bind:sendChatPrompt />
			{:else}
				<VersionsPanel {content} previewedVersionId={previewedVersion?.id} onPreview={previewVersion} onRestored={restored} onBeforeSave={saveNow} />
			{/if}
		</div>
	</aside>
</div>

<style>
	.EditorWorkspace { --content-editor-topbar-height: 3.25rem; height: calc(100dvh - var(--app-header-height)); display: grid; grid-template-columns: minmax(0, 1fr) 480px; background: var(--color-base-100); overflow: hidden; }
	.ArticleColumn { min-width: 0; overflow-y: auto; padding: 0 2.5rem; }
	.ArticleTopbar { position: sticky; top: 0; z-index: 8; height: var(--content-editor-topbar-height); display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.95); }
	.BackButton {
		display: inline-flex;
		align-items: center;
		align-self: center;
		gap: 0.4rem;
		height: var(--control-height);
		padding-inline: var(--control-padding-inline);
		border-radius: var(--control-radius);
		color: var(--color-text-light);
		font-size: 0.875rem;
		cursor: pointer;
	}
	.BackButton:hover { background: var(--color-gray-2); }
	.BackButton :global(.icon) { width: 1rem; height: 1rem; }
	.SaveState { display: inline-flex; align-items: center; gap: 0.4rem; color: var(--color-text-light); font-size: 0.875rem; }
	.SaveState :global(.icon) { width: 1rem; height: 1rem; }
	.EditorContainer { max-width: 62rem; margin: 0 auto; }
	.PreviewBar { max-width: 62rem; margin: 0 auto 0.5rem; background: #fff8e8; border: 1px solid #ffdc83; padding: 0.6rem 0.8rem; border-radius: 0.6rem; display: flex; justify-content: space-between; gap: 1rem; font-size: 0.85rem; }
	.PreviewBar button { color: var(--color-primary); font-weight: 650; cursor: pointer; }
	.SidePanel { width: 480px; min-width: 0; background: var(--color-base-300); border-left: 1px solid var(--color-border); display: grid; grid-template-rows: auto minmax(0, 1fr); }
	.PanelTabs { width: calc(100% - 1rem); margin: 0.5rem; padding: 0.25rem; display: flex; align-items: center; gap: 0.1rem; background: white; border: 1px solid var(--color-border); border-radius: 0.65rem; box-shadow: 0 2px 7px rgb(0 0 0 / 0.05); overflow-x: auto; }
	.PanelTabs button { flex: 1 1 auto; display: inline-flex; align-items: center; justify-content: center; gap: 0.25rem; padding: 0.5rem 0.4rem; border-radius: 0.5rem; white-space: nowrap; cursor: pointer; font-size: 0.84rem; }
	.PanelTabs button :global(.icon) { width: 1.1rem; height: 1.1rem; }
	.PanelTabs button.active { color: #2c155c; background: #fbf8ff; border: 1px solid #dccaff; }
	.PanelContent { min-height: 0; overflow-y: auto; padding: 0 0.5rem 2rem; }
	.PanelContent.chat { overflow: hidden; padding: 0; }
	.PanelContent :global(.PanelCard) { background: white; border: 1px solid var(--color-border); border-radius: 0.7rem; padding: 1.4rem; margin-bottom: 0.65rem; }
	@media (max-width: 1150px) { .ArticleColumn { padding: 0 1.25rem; } .PanelTabs button { font-size: 0.8rem; } }
	@media (max-width: 820px) { .EditorWorkspace { height: auto; min-height: calc(100dvh - var(--app-header-height)); grid-template-columns: 1fr; overflow: visible; } .ArticleColumn { min-height: 70dvh; overflow: visible; } .SidePanel { width: 100%; min-height: 44rem; border-left: 0; border-top: 1px solid var(--color-border); } .PanelContent { max-height: 70dvh; } }
</style>

<script lang="ts">
	import type { ContentDetail } from "$lib/server/contents";
	import IconPencilSimpleRegular from "phosphor-icons-svelte/IconPencilSimpleRegular.svelte";
	import { toast } from "svelte-sonner";
	import { updateBrief } from "../../../../../api/contents/contents.remote";

	let {
		content,
		onContentUpdated,
	}: {
		content: ContentDetail;
		onContentUpdated: (content: ContentDetail) => void;
	} = $props();

	let editing = $state(false);
	let briefDraft = $state("");
	let saving = $state(false);

	function startEditing() {
		briefDraft = content.brief;
		editing = true;
	}

	async function save() {
		saving = true;
		try {
			const updated = await updateBrief({
				id: content.id,
				projectId: content.projectId,
				brief: briefDraft,
			});
			onContentUpdated(updated);
			editing = false;
			toast.success("Brief mis à jour", { richColors: true });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Mise à jour impossible.", {
				richColors: true,
			});
		} finally {
			saving = false;
		}
	}
</script>

<section class="PanelCard BriefPanel" class:editing>
	<header>
		<h2>Brief</h2>
		<p>Indications renseignées lors de la création du contenu.</p>
	</header>

	{#if editing}
		<div class="BriefEditor">
			<textarea class="BriefTextarea" bind:value={briefDraft} aria-label="Brief du contenu"></textarea>
		</div>
		<div class="row gap-2 justify-end">
			<button class="btn control-size-1" disabled={saving} onclick={() => (editing = false)}>Annuler</button>
			<button class="btn btn-primary control-size-1" disabled={saving} onclick={save}>
				{saving ? "Mise à jour…" : "Mettre à jour"}
			</button>
		</div>
	{:else}
		<div class="BriefContent">
			{#if content.brief}<div>{content.brief}</div>{:else}<p class="Empty">Aucun brief n’a encore été saisi.</p>{/if}
			<button class="EditBrief" aria-label="Modifier le brief" onclick={startEditing}>
				<IconPencilSimpleRegular class="icon" />
			</button>
		</div>
	{/if}
</section>

<style>
	.BriefPanel { min-height: calc(100% - 0.65rem); display: flex; flex-direction: column; gap: 1rem; }
	.BriefPanel.editing { border-color: var(--color-primary) !important; }
	header h2 { font-size: 1.5rem; font-weight: 650; }
	header p { color: var(--color-text-light); }
	.BriefContent {
		position: relative;
		border: 0;
		border-top: 1px solid var(--color-border);
		border-radius: 0;
		padding: 1rem 0 0;
		font-size: 1.05rem;
		line-height: 1.45;
		white-space: pre-wrap;
		flex: 1;
	}
	.EditBrief { position: absolute; right: 0.65rem; bottom: 0.65rem; width: 1.85rem; height: 1.85rem; display: inline-flex; align-items: center; justify-content: center; color: #2c155c; padding: 0.3rem; border-radius: 0.4rem; cursor: pointer; }
	.EditBrief :global(.icon) { width: 1rem; height: 1rem; }
	.EditBrief:hover { background: var(--color-primary-light); }
	.BriefEditor { display: flex; flex: 1; min-height: 0; padding-top: 1rem; border-top: 1px solid var(--color-border); }
	.BriefTextarea { width: 100%; flex: 1; min-height: 0; overflow-y: auto; border: 0; border-radius: 0; padding: 0; resize: none; outline: none; background: transparent; font-size: 1.05rem; line-height: 1.45; }
	.Empty { color: var(--color-text-light); }
</style>

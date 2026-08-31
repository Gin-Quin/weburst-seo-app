<script lang="ts">
	import type { ContentDetail } from "$lib/server/contents";
	import IconPencilSimpleRegular from "phosphor-icons-svelte/IconPencilSimpleRegular.svelte";
	import { tick } from "svelte";
	import { toast } from "svelte-sonner";
	import {
		refreshOptimization,
		updateBrief,
	} from "../../../../../api/contents/contents.remote";

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
	let briefTextarea = $state<HTMLTextAreaElement>();

	async function startEditing() {
		briefDraft = content.brief;
		editing = true;
		await tick();
		briefTextarea?.focus();
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
			void updateSeoOptimizations(updated);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Mise à jour impossible.", {
				richColors: true,
			});
		} finally {
			saving = false;
		}
	}

	async function updateSeoOptimizations(updatedContent: ContentDetail) {
		if (!updatedContent.serpmanticsGuideId) return;

		const toastId = toast.loading("Mise à jour des optimisations SEO...");
		try {
			let optimizedContent: ContentDetail;
			do {
				optimizedContent = await refreshOptimization({
					id: updatedContent.id,
					projectId: updatedContent.projectId,
				});
				onContentUpdated(optimizedContent);
				if (optimizedContent.serpmanticsStatus === "pending") {
					await new Promise((resolve) => setTimeout(resolve, 5_000));
				}
			} while (optimizedContent.serpmanticsStatus === "pending");

			if (optimizedContent.serpmanticsStatus === "failed") {
				throw new Error(
					optimizedContent.serpmanticsError ?? "La mise à jour des optimisations SEO a échoué.",
				);
			}
			toast.dismiss(toastId);
			toast.success("Optimisations SEO mises à jour", { richColors: true });
		} catch (error) {
			toast.dismiss(toastId);
			toast.error(
				error instanceof Error
					? error.message
					: "La mise à jour des optimisations SEO a échoué.",
				{ richColors: true },
			);
		}
	}
</script>

<section class="PanelCard BriefPanel" class:editing>
	<header>
		<div class="BriefHeaderRow">
			<h2>Brief</h2>
			{#if !editing}
				<button class="EditBrief control-size-1" onclick={startEditing}>
					<IconPencilSimpleRegular class="icon" />
					Éditer le brief
				</button>
			{/if}
		</div>
		<p>Indications renseignées lors de la création du contenu.</p>
	</header>

	{#if editing}
		<div class="BriefEditor">
			<textarea
				class="BriefTextarea"
				bind:this={briefTextarea}
				bind:value={briefDraft}
				aria-label="Brief du contenu"
			></textarea>
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
		</div>
	{/if}
</section>

<style>
	.BriefPanel { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 1rem; margin-bottom: 0 !important; }
	.BriefPanel.editing { border-color: var(--color-primary) !important; }
	.BriefHeaderRow { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
	header h2 { font-size: 1.5rem; font-weight: 650; }
	header p { color: var(--color-text-light); }
	.BriefContent {
		border: 0;
		border-top: 1px solid var(--color-border);
		border-radius: 0;
		padding: 0.5rem 0 0;
		font-size: 1.05rem;
		line-height: 1.45;
		white-space: pre-wrap;
		flex: 1;
	}
	.EditBrief { display: flex; align-items: center; gap: 0.4rem; width: fit-content; height: var(--control-height); padding-inline: var(--control-padding-inline); border-radius: var(--control-radius); color: var(--color-text-light); font-size: 0.875rem; cursor: pointer; transform: translate(4px, -4px); }
	.EditBrief :global(.icon) { width: 1rem; height: 1rem; }
	.EditBrief:hover { background: var(--color-gray-2); }
	.BriefEditor { display: flex; flex: 1; min-height: 0; padding-top: 1rem; border-top: 1px solid var(--color-border); }
	.BriefTextarea { width: 100%; flex: 1; min-height: 0; overflow-y: auto; border: 0; border-radius: 0; padding: 0; resize: none; outline: none; background: transparent; font-size: 1.05rem; line-height: 1.45; }
	.Empty {
		padding-top: 2rem;
		color: color-mix(in srgb, var(--color-text-light) 65%, white);
		font-size: 0.875rem;
		text-align: center;
	}
</style>

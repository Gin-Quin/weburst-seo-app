<script lang="ts">
	import OptimizationScore from "$lib/components/OptimizationScore.svelte";
	import { context } from "$lib/stores/context.svelte";
	import type { ContentDetail, ContentVersionDetail } from "$lib/server/contents";
	import IconArrowCounterClockwiseRegular from "phosphor-icons-svelte/IconArrowCounterClockwiseRegular.svelte";
	import IconEyeRegular from "phosphor-icons-svelte/IconEyeRegular.svelte";
	import IconPlusRegular from "phosphor-icons-svelte/IconPlusRegular.svelte";
	import { toast } from "svelte-sonner";
	import {
		createVersion,
		listVersions,
		restoreVersion,
	} from "../../../../../api/contents/contents.remote";

	let {
		content,
		previewedVersionId,
		onPreview,
		onRestored,
		onBeforeSave,
	}: {
		content: ContentDetail;
		previewedVersionId?: string;
		onPreview: (version: ContentVersionDetail) => void;
		onRestored: (content: ContentDetail) => void;
		onBeforeSave: () => Promise<void>;
	} = $props();

	let saving = $state(false);
	const versionsQuery = $derived(listVersions({ id: content.id, projectId: content.projectId }));

	function confirmSave() {
		context.openConfirmDialog?.({
			title: "Souhaitez-vous faire une sauvegarde<br />de la version actuelle&nbsp;?",
			description: "Vous êtes sur le point de faire une sauvegarde de la version actuelle de votre contenu ainsi que de son brief. Vous pourrez la retrouver dans le panneau Versions.",
			color: "primary",
			confirmLabel: "Sauvegarder la version",
			then: save,
		});
	}

	async function save() {
		saving = true;
		try {
			await onBeforeSave();
			await createVersion({ id: content.id, projectId: content.projectId });
			toast.success("Version sauvegardée", { richColors: true });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Sauvegarde impossible.", { richColors: true });
		} finally {
			saving = false;
		}
	}

	async function restore(version: ContentVersionDetail) {
		try {
			await onBeforeSave();
			const restored = await restoreVersion({
				projectId: content.projectId,
				contentId: content.id,
				versionId: version.id,
			});
			onRestored(restored);
			toast.success(`Version ${version.version} restaurée`, { richColors: true });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Restauration impossible.", { richColors: true });
		}
	}

	function confirmRestore(version: ContentVersionDetail) {
		context.openConfirmDialog?.({
			title: `Restaurer la version ${version.version}&nbsp;?`,
			description:
				"Le contenu et le brief actuels seront remplacés par ceux de cette version.",
			confirmLabel: "Restaurer cette version",
			color: "primary",
			then: () => restore(version),
		});
	}

	function formatDate(timestamp: number) {
		return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(timestamp);
	}
</script>

<section class="VersionsPanel">
	<button class="SaveVersionButton" disabled={saving} onclick={confirmSave}>
		<IconPlusRegular class="icon" /> {saving ? "Sauvegarde…" : "Sauvegarder nouvelle version"}
	</button>

	{#await versionsQuery}
		<div class="center py-8"><span class="loading loading-spinner text-primary"></span></div>
	{:then versions}
		<div class="VersionList">
			{#each versions as version (version.id)}
				<article class="VersionCard" class:previewed={previewedVersionId === version.id}>
					<div class="VersionMeta">
						<div class="VersionTitle">
							<span class="VersionName">Version {version.version}</span>
							<span class="VersionDate">{formatDate(version.createdAt)}</span>
						</div>
					</div>
					<div class="VersionControls">
						{#if version.score != null}<OptimizationScore score={version.score} />{/if}
						<div class="VersionActions">
							<button class="btn control-size-1" title="Prévisualiser" onclick={() => onPreview(version)}><IconEyeRegular class="icon" /></button>
							<button class="btn control-size-1" title="Restaurer" onclick={() => confirmRestore(version)}><IconArrowCounterClockwiseRegular class="icon" /></button>
						</div>
					</div>
				</article>
			{/each}
			{#if versions.length === 0}<p class="EmptyVersions">Aucune version sauvegardée.</p>{/if}
		</div>
	{/await}
</section>

<style>
	.VersionsPanel { width: 100%; padding: 0.75rem 0; display: flex; flex-direction: column; align-items: stretch; }
	.SaveVersionButton { align-self: flex-end; width: fit-content; margin: 0 0.5rem 0.75rem; min-height: 2.8rem; padding-inline: 1rem; border-radius: 0.5rem; background: var(--color-primary); color: white; display: inline-flex; align-items: center; justify-content: flex-start; gap: 0.5rem; cursor: pointer; }
	.SaveVersionButton:disabled { opacity: 0.5; }
	.VersionList { display: flex; flex-direction: column; gap: 0.45rem; }
	.VersionCard { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.85rem; border: 1px solid var(--color-border); border-radius: 1rem; background: white; }
	.VersionCard.previewed { border-color: var(--color-primary); background: var(--color-primary-light); }
	.VersionMeta { min-width: 0; }
	.VersionTitle { display: flex; align-items: baseline; gap: 0.45rem; white-space: nowrap; }
	.VersionName { font-size: 1.2rem; font-weight: 650; }
	.VersionControls { display: flex; align-items: center; gap: 0.6rem; }
	.VersionDate { color: var(--color-text-light); font-size: calc(0.9rem - 2px); }
	.VersionActions { display: flex; gap: 0.35rem; }
	.VersionActions .btn { padding-inline: 0.55rem; }
	.EmptyVersions { text-align: center; color: var(--color-text-light); padding: 3rem 1rem; }
</style>

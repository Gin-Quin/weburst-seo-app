<script lang="ts">
	import { goto } from "$app/navigation";
	import { getKeywordClusters } from "../../../../../api/keywords/index.remote";
	import { createContent, updateContent } from "../../../../../api/contents/contents.remote";
	import type { Content, ContentPriority } from "$lib/server/db/schema";
	import IconFolderRegular from "phosphor-icons-svelte/IconFolderRegular.svelte";
	import IconGlobeRegular from "phosphor-icons-svelte/IconGlobeRegular.svelte";
	import IconPencilSimpleRegular from "phosphor-icons-svelte/IconPencilSimpleRegular.svelte";
	import { toast } from "svelte-sonner";
	import { getAvailableClusterNames } from "./getAvailableClusterNames";

	let {
		projectId,
		ref = $bindable(),
		openCreateContentDialog = $bindable(),
		openEditContentDialog = $bindable(),
	}: {
		projectId: string;
		ref?: HTMLDialogElement;
		openCreateContentDialog?: () => void;
		openEditContentDialog?: (content: EditableContent) => void;
	} = $props();

	type EditableContent = Pick<Content, "id" | "title" | "cluster" | "priority" | "brief">;

	let editingContentId = $state<string | null>(null);
	let title = $state("");
	let cluster = $state("");
	let priority = $state<ContentPriority | "">("");
	let existingUrl = $state("");
	let brief = $state("");
	let saving = $state(false);
	let clusterNames = $state<string[]>([]);
	let loadingClusters = $state(false);
	const canCreate = $derived(title.trim().length > 0 && !saving);
	const isEditing = $derived(editingContentId !== null);
	const importingArticle = $derived(!isEditing && saving && Boolean(existingUrl));

	openCreateContentDialog = () => {
		reset();
		ref?.showModal();
		void loadClusters();
	};

	openEditContentDialog = (content) => {
		reset();
		editingContentId = content.id;
		title = content.title;
		cluster = content.cluster ?? "";
		priority = content.priority ?? "";
		brief = content.brief;
		ref?.showModal();
		void loadClusters();
	};

	async function loadClusters() {
		loadingClusters = true;
		clusterNames = [];
		try {
			const clusters = await getKeywordClusters({ projectId });
			clusterNames = getAvailableClusterNames(clusters);
		} catch {
			toast.error("Les clusters de la dernière analyse n’ont pas pu être chargés.", {
				richColors: true,
			});
		} finally {
			loadingClusters = false;
		}
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canCreate) return;
		saving = true;
		try {
			if (editingContentId) {
				await updateContent({
					projectId,
					id: editingContentId,
					title,
					cluster,
					priority: priority || null,
					brief,
				});
				ref?.close();
				return;
			}

			const created = await createContent({
				projectId,
				title,
				cluster: cluster || undefined,
				priority: priority || undefined,
				existingUrl: existingUrl || undefined,
				brief,
			});
			ref?.close();
			await goto(`/projects/${projectId}/contents/${created.id}`);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: isEditing
						? "Le contenu n’a pas pu être modifié."
						: "Le contenu n’a pas pu être créé.",
				{ richColors: true },
			);
		} finally {
			saving = false;
		}
	}

	function reset() {
		editingContentId = null;
		title = "";
		cluster = "";
		priority = "";
		existingUrl = "";
		brief = "";
	}

	function handleCancel(event: Event) {
		if (importingArticle) event.preventDefault();
	}
</script>

<dialog bind:this={ref} class="modal" oncancel={handleCancel}>
	<div class="modal-box CreateContentModal w-[46rem]">
		<header>{isEditing ? "Éditer un contenu" : "Créer un contenu"}</header>

		<form class="col gap-5" onsubmit={submit}>
			<div class="field">
				<label class="field-title" for="content-title">Titre du contenu</label>
				<label class="input control-size-3 w-full">
					<IconPencilSimpleRegular class="icon" />
					<input
						id="content-title"
						class="grow"
						bind:value={title}
						placeholder="Porte de garage aluminium"
						required
					/>
				</label>
			</div>

			{#if !loadingClusters && clusterNames.length > 0}
				<div class="field">
					<label class="field-title" for="content-cluster">Lier à un cluster</label>
					<label class="select control-size-3 w-full">
						<IconFolderRegular class="icon" />
						<select
							id="content-cluster"
							class="select control-size-3"
							bind:value={cluster}
						>
							<option value="">Sélectionner un cluster</option>
							{#each clusterNames as name (name)}
								<option value={name}>{name}</option>
							{/each}
						</select>
					</label>
				</div>
			{/if}

			<div class="field">
				<label class="field-title" for="content-priority">Assigner une priorité</label>
				<label class="select control-size-3 w-full">
					<IconFolderRegular class="icon" />
					<select
						id="content-priority"
						class="select control-size-3 PrioritySelect priority-{priority || 'unset'}"
						bind:value={priority}
					>
						<option value="">Sélectionner une priorité</option>
						<option class="PriorityOption priority-high" value="high">Haute</option>
						<option class="PriorityOption priority-moderate" value="moderate">Modérée</option>
						<option class="PriorityOption priority-low" value="low">Faible</option>
					</select>
				</label>
			</div>

			{#if !isEditing}
				<div class="field">
					<label class="field-title" for="content-url">
						Lier à un contenu existant <span class="font-normal">(facultatif)</span>
					</label>
					<label class="input control-size-3 w-full">
						<IconGlobeRegular class="icon" />
						<input
							id="content-url"
							class="grow"
							type="url"
							bind:value={existingUrl}
							placeholder="Saisir l’URL du contenu existant"
						/>
					</label>
				</div>
			{/if}

			<div class="field">
				<label class="field-title" for="content-brief">Brief</label>
				<textarea
					id="content-brief"
					class="textarea w-full min-h-34"
					bind:value={brief}
					placeholder="Taper votre brief dans cet espace"
				></textarea>
			</div>

			<footer class="grid grid-cols-2 gap-3 pt-2">
				{#if importingArticle}
					<p class="ImportStatus col-span-2" role="status" aria-live="polite">
						Importation de l’article en cours. Cette opération peut prendre une vingtaine de secondes.
					</p>
				{/if}
				<button
					class="btn control-size-2"
					type="button"
					disabled={importingArticle}
					onclick={() => ref?.close()}
				>
					Annuler
				</button>
				<button class="btn btn-primary control-size-2" type="submit" disabled={!canCreate}>
					{importingArticle
						? "Importation de l’article…"
						: saving
							? isEditing
								? "Enregistrement…"
								: "Création…"
							: isEditing
								? "Enregistrer les modifications"
								: "Créer le contenu"}
				</button>
			</footer>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop"><button disabled={importingArticle}>Fermer</button></form>
</dialog>

<style>
	.CreateContentModal {
		padding: 2rem;
	}

	.CreateContentModal > header {
		font-size: 2rem;
		padding-bottom: 1.5rem;
	}

	.textarea {
		border: 1px solid var(--input);
		border-radius: var(--control-size-3-radius);
		padding: 1rem 1.25rem;
	}

	.PrioritySelect:not(.priority-unset),
	.PriorityOption {
		font-weight: bold;
	}

	.PrioritySelect.priority-high,
	.PriorityOption.priority-high {
		color: var(--color-error);
	}

	.PrioritySelect.priority-moderate,
	.PriorityOption.priority-moderate {
		color: var(--color-warning);
	}

	.PrioritySelect.priority-low,
	.PriorityOption.priority-low {
		color: var(--color-success);
	}

	.ImportStatus {
		margin: 0;
		color: var(--color-text-light);
		font-size: 0.85rem;
		text-align: center;
	}

	@media (min-width: 720px) {
		.CreateContentModal form > :global(.field:nth-child(2)),
		.CreateContentModal form > :global(.field:nth-child(3)) {
			width: 100%;
		}
	}
</style>

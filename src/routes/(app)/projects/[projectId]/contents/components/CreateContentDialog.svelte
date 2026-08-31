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
	const priorityOptions: { value: ContentPriority | ""; label: string; className: string }[] = [
		{ value: "", label: "Aucune", className: "priority-none" },
		{ value: "high", label: "Haute", className: "priority-high" },
		{ value: "moderate", label: "Modérée", className: "priority-moderate" },
		{ value: "low", label: "Faible", className: "priority-low" },
	];

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

	function autoGrow(node: HTMLTextAreaElement, value: string) {
		function resize() {
			const minHeight = Number.parseFloat(getComputedStyle(node).minHeight) || 0;
			node.style.height = "0";
			node.style.height = `${Math.max(node.scrollHeight, minHeight)}px`;
		}

		resize();
		node.addEventListener("input", resize);

		return {
			update(nextValue: string) {
				if (nextValue !== value) resize();
				value = nextValue;
			},
			destroy() {
				node.removeEventListener("input", resize);
			},
		};
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

			<fieldset class="field PriorityField">
				<legend class="field-title">Assigner une priorité</legend>
				<div class="PriorityChoices">
					{#each priorityOptions as option (option.value)}
						<label
							class="PriorityChoice PriorityBadge control-size-2 {option.className}"
							class:PriorityChoiceSelected={priority === option.value}
						>
							<input
								type="radio"
								name="content-priority"
								value={option.value}
								bind:group={priority}
							/>
							<span>{option.label}</span>
						</label>
					{/each}
				</div>
			</fieldset>

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
					class="textarea w-full"
					bind:value={brief}
					rows="1"
					placeholder="Taper votre brief dans cet espace"
					use:autoGrow={brief}
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
		min-height: var(--control-size-3-height);
		overflow-y: hidden;
		resize: none;
		font-size: 1rem;
	}

	.PriorityChoices {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.PriorityField {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
		gap: 4px;
	}

	.PriorityChoice {
		gap: 0.45rem;
		height: var(--control-height);
		min-height: var(--control-height);
		padding: 0 var(--control-padding-inline);
		border: 1px solid var(--color-border);
		border-radius: var(--control-radius);
		background: transparent;
		font-weight: 400;
		cursor: pointer;
		transition: border-color 120ms ease, transform 120ms ease;
		user-select: none;
	}

	.PriorityChoice.priority-none {
		color: var(--color-base-content);
	}

	.PriorityChoice:hover {
		transform: translateY(-1px);
	}

	.PriorityChoiceSelected {
		border-color: currentColor;
	}

	.PriorityChoice.PriorityChoiceSelected:focus-within {
		border-color: currentColor !important;
	}

	.PriorityChoice:has(input:focus-visible) {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	.PriorityChoice input {
		width: 1rem;
		height: 1rem;
		margin: 0;
		color: inherit;
		accent-color: currentColor;
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

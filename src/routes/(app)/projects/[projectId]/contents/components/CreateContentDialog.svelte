<script lang="ts">
	import { goto } from "$app/navigation";
	import { getKeywordClusters } from "../../../../../api/keywords/index.remote";
	import { createContent } from "../../../../../api/contents/contents.remote";
	import type { ContentPriority } from "$lib/server/db/schema";
	import IconFolderRegular from "phosphor-icons-svelte/IconFolderRegular.svelte";
	import IconGlobeRegular from "phosphor-icons-svelte/IconGlobeRegular.svelte";
	import IconPencilSimpleRegular from "phosphor-icons-svelte/IconPencilSimpleRegular.svelte";
	import { toast } from "svelte-sonner";

	let {
		projectId,
		ref = $bindable(),
		openCreateContentDialog = $bindable(),
	}: {
		projectId: string;
		ref?: HTMLDialogElement;
		openCreateContentDialog?: () => void;
	} = $props();

	let title = $state("");
	let cluster = $state("");
	let priority = $state<ContentPriority | "">("");
	let existingUrl = $state("");
	let brief = $state("");
	let saving = $state(false);
	let clusterNames = $state<string[]>([]);
	let loadingClusters = $state(false);
	const canCreate = $derived(title.trim().length > 0 && !saving);

	openCreateContentDialog = () => {
		reset();
		ref?.showModal();
		void loadClusters();
	};

	async function loadClusters() {
		loadingClusters = true;
		try {
			const clusters = await getKeywordClusters({ projectId });
			clusterNames = [
				...new Set(
					(clusters ?? [])
						.map((group) => group[0]?.clusters?.trim() || group[0]?.keyword?.trim())
						.filter((name): name is string => Boolean(name)),
				),
			];
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
				error instanceof Error ? error.message : "Le contenu n’a pas pu être créé.",
				{ richColors: true },
			);
		} finally {
			saving = false;
		}
	}

	function reset() {
		title = "";
		cluster = "";
		priority = "";
		existingUrl = "";
		brief = "";
	}
</script>

<dialog bind:this={ref} class="modal">
	<div class="modal-box CreateContentModal w-[46rem]">
		<header>Créer un contenu</header>

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

			<div class="field">
				<label class="field-title" for="content-cluster">Lier à un cluster</label>
				<label class="select control-size-3 w-full">
					<IconFolderRegular class="icon" />
					<select
						id="content-cluster"
						class="select control-size-3"
						bind:value={cluster}
						disabled={loadingClusters}
					>
						<option value="">
							{loadingClusters ? "Chargement des clusters…" : "Sélectionner un cluster"}
						</option>
						{#each clusterNames as name (name)}
							<option value={name}>{name}</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="field">
				<label class="field-title" for="content-priority">Assigner une priorité</label>
				<label class="select control-size-3 w-full">
					<IconFolderRegular class="icon" />
					<select
						id="content-priority"
						class="select control-size-3"
						bind:value={priority}
					>
						<option value="">Sélectionner une priorité</option>
						<option value="high">Haute</option>
						<option value="moderate">Modérée</option>
						<option value="low">Faible</option>
					</select>
				</label>
			</div>

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
				<button class="btn control-size-2" type="button" onclick={() => ref?.close()}>
					Annuler
				</button>
				<button class="btn btn-primary control-size-2" type="submit" disabled={!canCreate}>
					{saving ? "Création…" : "Créer le contenu"}
				</button>
			</footer>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop"><button>Fermer</button></form>
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

	@media (min-width: 720px) {
		.CreateContentModal form > :global(.field:nth-child(2)),
		.CreateContentModal form > :global(.field:nth-child(3)) {
			width: 100%;
		}
	}
</style>

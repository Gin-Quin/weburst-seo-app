<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { deepEqual } from "$lib/objects";
	import type { Project } from "$lib/server/db/schema";
	import { createId } from "@paralleldrive/cuid2";
	import IconFolderRegular from "phosphor-icons-svelte/IconFolderRegular.svelte";
	import IconGlobeRegular from "phosphor-icons-svelte/IconGlobeRegular.svelte";
	import IconLinkRegular from "phosphor-icons-svelte/IconLinkRegular.svelte";
	import IconRepeatRegular from "phosphor-icons-svelte/IconRepeatRegular.svelte";
	import IconUserCheckRegular from "phosphor-icons-svelte/IconUserCheckRegular.svelte";
	import IconTrashRegular from "phosphor-icons-svelte/IconTrashRegular.svelte";
	import IconUserRegular from "phosphor-icons-svelte/IconUserRegular.svelte";
	import { createProject, updateProject } from "../(api)/projects.remote";
	import {
		keywordAnalysisFrequencies,
		projectTypes,
	} from "$lib/i18n/contents/projects";
	import SelectUser from "$lib/components/SelectUser.svelte";
	import PickUser from "$lib/components/PickUser.svelte";

	const content = defineContent({
		en: {
			createProject: "Create a new project",
			updateProject: "Update a project",
			cancel: "Cancel",
			create: "Create project",
			save: "Save",
			clientName: "Client name",
			domain: "Domain",
			keywordAnalysisFrequency: "Keyword analysis",
			type: "Type",
			websiteUrl: "Website URL",
			leaders: "Project leaders",
			createNewUser: "+ New user",
		},
		fr: {
			createProject: "Créer un nouveau projet",
			updateProject: "Modifier un projet",
			cancel: "Annuler",
			create: "Créer projet",
			save: "Sauvegarder",
			clientName: "Nom du client",
			domain: "Domaine",
			keywordAnalysisFrequency: "Analyse des mots-clés",
			type: "Type",
			websiteUrl: "URL du site web",
			leaders: "Chefs de projet",
			createNewUser: "+ Nouvel utilisateur",
		},
	});

	let {
		ref = $bindable(),
		edit,
		openProjectDialog = $bindable(),
	}: {
		ref?: HTMLDialogElement;
		edit?: Project;
		openProjectDialog?: (project?: Project) => void;
	} = $props();

	let updating = $state(false);
	let project = $state<Project>(getDefaultValues());
	let leaderIds = $state<string[]>([]);

	const hasValidChanges = $derived(
		project.clientName &&
			project.domain &&
			project.keywordAnalysisFrequency &&
			project.type &&
			project.websiteUrl &&
			leaderIds.length > 0 &&
			(!edit || !deepEqual(edit, project)),
	);

	openProjectDialog = (existingProject) => {
		edit = existingProject;
		project = getDefaultValues();
		ref?.showModal();
	};

	async function save() {
		updating = true;
		if (edit) {
			const response = await updateProject([edit.id, project]);
		} else {
			const response = await createProject({ ...project, leaderIds });
		}
		updating = false;
		ref?.close();
	}

	function getDefaultValues(): Project {
		return {
			id: edit?.id ?? createId(),
			clientName: edit?.clientName ?? "",
			domain: edit?.domain ?? "",
			keywordAnalysisFrequency: edit?.keywordAnalysisFrequency ?? "1/month",
			type: edit?.type ?? "audit",
			websiteUrl: edit?.websiteUrl ?? "",
			deletedAt: null,
		};
	}

	function cancel() {
		project = getDefaultValues();
	}
</script>

<dialog bind:this={ref} class="modal">
	<div class="modal-box w-[42rem]">
		<header>
			{edit ? $content.updateProject : $content.createProject}
		</header>

		<form method="dialog" class="col gap-6 items-stretch">
			<div class="grid grid-cols-2 gap-3">
				<div class="field grow">
					<div class="field-title">{$content.clientName}</div>
					<label class="input w-full">
						<IconUserRegular class="icon" />
						<input
							class="grow"
							name="clientName"
							bind:value={project.clientName}
							placeholder={$content.clientName}
						/>
					</label>
				</div>

				<div class="field grow">
					<div class="field-title">{$content.domain}</div>
					<label class="input w-full">
						<IconGlobeRegular class="icon" />
						<input
							class="grow"
							name="domain"
							bind:value={project.domain}
							placeholder={$content.domain}
						/>
					</label>
				</div>
			</div>

			<div class="row gap-3">
				<div class="field grow">
					<div class="field-title">{$content.websiteUrl}</div>
					<label class="input w-full">
						<IconLinkRegular class="icon" />
						<input
							class="grow"
							name="websiteUrl"
							type="url"
							bind:value={project.websiteUrl}
							placeholder={$content.websiteUrl}
						/>
					</label>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="field">
					<div class="field-title">{$content.type}</div>
					<label class="select">
						<IconFolderRegular class="icon" />
						<select class="select" bind:value={project.type}>
							{#each Object.entries($projectTypes) as [value, label]}
								<option {value}>{label}</option>
							{/each}
						</select>
					</label>
				</div>

				<div class="field">
					<div class="field-title">{$content.keywordAnalysisFrequency}</div>
					<label class="select">
						<IconRepeatRegular class="icon" />
						<select
							class="select"
							bind:value={project.keywordAnalysisFrequency}
						>
							{#each Object.entries($keywordAnalysisFrequencies) as [value, label]}
								<option {value}>{label}</option>
							{/each}
						</select>
					</label>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-3">
				<div class="field">
					<div class="field-title">{$content.leaders}</div>
					{#each leaderIds as leaderId, index (leaderId)}
						<div class="row items-center w-full gap-2">
							<SelectUser
								bind:userId={leaderIds[index]}
								class="grow"
								exclude={leaderIds.filter((id) => id !== leaderId)}
							/>
							<button
								class="row center icon h-[3.5rem] w-[3.5rem] rounded-full! cursor-pointer"
								onclick={(event) => {
									event.preventDefault();
									event.stopPropagation();
									leaderIds.splice(index, 1);
								}}
							>
								<IconTrashRegular />
							</button>
						</div>
					{/each}

					<PickUser
						class="w-full"
						onPickUser={(userId) => leaderIds.push(userId)}
						exclude={leaderIds}
					/>
				</div>
			</div>

			<div class="row gap-3 pt-2">
				<button class="btn btn-large grow" disabled={updating} onclick={cancel}>
					{$content.cancel}
				</button>
				<button
					class="btn btn-primary grow"
					disabled={!hasValidChanges || updating}
					onclick={save}
					type="submit"
				>
					{edit ? $content.save : $content.create}
				</button>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button></button>
	</form>
</dialog>

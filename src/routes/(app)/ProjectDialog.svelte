<script lang="ts">
	import PickUser from "$lib/components/PickUser.svelte";
	import SelectUser from "$lib/components/SelectUser.svelte";
	import {
		keywordAnalysisFrequencies,
		projectTypes,
	} from "$lib/i18n/contents/projects";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { deepEqual } from "$lib/objects";
	import { createId } from "@paralleldrive/cuid2";
	import IconFolderRegular from "phosphor-icons-svelte/IconFolderRegular.svelte";
	import IconGlobeRegular from "phosphor-icons-svelte/IconGlobeRegular.svelte";
	import IconLinkRegular from "phosphor-icons-svelte/IconLinkRegular.svelte";
	import IconRepeatRegular from "phosphor-icons-svelte/IconRepeatRegular.svelte";
	import IconTrashRegular from "phosphor-icons-svelte/IconTrashRegular.svelte";
	import IconUserRegular from "phosphor-icons-svelte/IconUserRegular.svelte";
	import type { ProjectInfo } from "../api/projects.remote";
	import { createProject, updateProject } from "../api/projects.remote";
	import type { CreateProject } from "../api/projects.schema";
	import { toast } from "svelte-sonner";

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
			projectUpdated: "Project updated",
			projectCreationFailed: "Project creation failed",
			projectUpdateFailed: "Project update failed",
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
			projectUpdated: "Le projet a été mis à jour",
			projectCreationFailed: "Échec de la création du projet",
			projectUpdateFailed: "Échec de la mise à jour du projet",
		},
	});

	let {
		ref = $bindable(),
		edit,
		openProjectDialog = $bindable(),
	}: {
		ref?: HTMLDialogElement;
		edit?: ProjectInfo;
		openProjectDialog?: (project?: ProjectInfo) => void;
	} = $props();

	let updating = $state(false);
	let project = $state<CreateProject>(getDefaultValues());

	const hasValidChanges = $derived(
		project.clientName &&
			project.domain &&
			project.keywordAnalysisFrequency &&
			project.type &&
			project.websiteUrl &&
			(edit ? true : project.leaderIds.length > 0) &&
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
			try {
				await updateProject([edit.id, project]);
				toast.success($content.projectUpdated, { richColors: true });
			} catch (error) {
				toast.error($content.projectUpdateFailed, { richColors: true });
			}
		} else {
			try {
				await createProject({
					...project,
					leaderIds: project.leaderIds,
				});
			} catch (error) {
				toast.error($content.projectCreationFailed, { richColors: true });
			}
		}
		updating = false;
		ref?.close();
	}

	function getDefaultValues(): CreateProject {
		return {
			id: edit?.id ?? createId(),
			clientName: edit?.clientName ?? "",
			domain: edit?.domain ?? "",
			keywordAnalysisFrequency: edit?.keywordAnalysisFrequency ?? "1/month",
			type: edit?.type ?? "audit",
			websiteUrl: edit?.websiteUrl ?? "",
			leaderIds: edit?.leaders.map((leader) => leader.id) ?? [],
		};
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
							required
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
							required
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

			<div
				class="grid gap-3 {project.type == 'audit'
					? 'grid-cols-2'
					: 'grid-cols-1'}"
			>
				<div class="field">
					<div class="field-title">{$content.type}</div>
					<label class="select w-full">
						<IconFolderRegular class="icon" />
						<select class="select" bind:value={project.type}>
							{#each Object.entries($projectTypes) as [value, label]}
								<option {value}>{label}</option>
							{/each}
						</select>
					</label>
				</div>

				{#if project.type == "audit"}
					<div class="field">
						<div class="field-title">{$content.keywordAnalysisFrequency}</div>
						<label class="select w-full">
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
				{/if}
			</div>

			<div class="grid grid-cols-1 gap-[0.375rem]">
				<div class="field">
					<div class="field-title">{$content.leaders}</div>
					<div class="col gap-[0.375rem] w-full">
						{#each project.leaderIds as leaderId, index (leaderId)}
							<div class="row items-center w-full gap-2">
								<SelectUser
									bind:userId={project.leaderIds[index]!}
									class="grow"
									exclude={project.leaderIds.filter((id) => id !== leaderId)}
								/>
								<button
									type="button"
									class="row center icon h-[3.5rem] w-[3.5rem] rounded-full! cursor-pointer"
									onclick={(event) => {
										event.preventDefault();
										event.stopPropagation();
										project.leaderIds.splice(index, 1);
									}}
								>
									<IconTrashRegular />
								</button>
							</div>
						{/each}
					</div>
				</div>

				<PickUser
					class="w-full"
					onPickUser={(userId) => project.leaderIds.push(userId)}
					exclude={project.leaderIds}
				/>
			</div>

			<div class="row gap-3 pt-2">
				<button
					class="btn btn-large grow"
					disabled={updating}
					type="button"
					onclick={() => ref?.close()}
				>
					{$content.cancel}
				</button>
				<button
					type="submit"
					class="btn btn-primary grow"
					disabled={!hasValidChanges || updating}
					onclick={save}
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

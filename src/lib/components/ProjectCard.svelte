<script lang="ts">
	import { goto } from "$app/navigation";
	import { projectTypes } from "$lib/i18n/contents/projects";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { User } from "$lib/server/db/schema";
	import { context } from "$lib/stores/context.svelte";
	import IconDotsThreeVerticalBold from "phosphor-icons-svelte/IconDotsThreeVerticalBold.svelte";
	import IconPencilSimpleRegular from "phosphor-icons-svelte/IconPencilSimpleRegular.svelte";
	import IconTrashRegular from "phosphor-icons-svelte/IconTrashRegular.svelte";
	import {
		deleteProject,
		type ProjectInfo,
	} from "../../routes/api/projects.remote";
	import Avatar from "./Avatar.svelte";

	const content = defineContent({
		en: {
			updateProject: "Update project",
			deleteProject: "Delete project",
			confirmDeleteProject: (name: string) =>
				`Are you sure you want to delete the project "${name}"?`,
		},
		fr: {
			updateProject: "Modifier le projet",
			deleteProject: "Supprimer le projet",
			confirmDeleteProject: (name: string) =>
				`Êtes-vous certain de vouloir supprimer le projet "${name}" ?`,
		},
	});

	let {
		project,
		onEdit = (project) => context.openProjectDialog?.(project),
		onDelete = (project) =>
			context.openConfirmDialog?.({
				title: $content.confirmDeleteProject(project.domain),
				then: () => deleteProject(project.id),
			}),
	}: {
		project: ProjectInfo;
		onEdit?: (project: ProjectInfo) => void;
		onDelete?: (project: ProjectInfo) => void;
	} = $props();
</script>

<button
	class="ProjectCard cursor-pointer card px-6! py-5! col! justify-stretch items-start bg-gray-1"
	onclick={() => goto(`/projects/${project.id}`)}
>
	<div class="row justify-between w-full">
		<div class="badge badge-info">
			{$projectTypes[project.type]}
		</div>

		<div
			class="dropdown dropdown-bottom dropdown-end z-10 absolute right-5"
			onclick={(event) => {
				event.stopPropagation();
				event.preventDefault();
				event.stopImmediatePropagation();
			}}
		>
			<div tabindex="0" role="button" class="cursor-pointer z-10">
				<IconDotsThreeVerticalBold class="text-4xl text-accent" />
			</div>
			<ul
				tabindex="0"
				class="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
			>
				<li>
					<a onclick={() => onEdit(project)}>
						<IconPencilSimpleRegular class="text-lg" />
						{$content.updateProject}
					</a>
				</li>
				<li>
					<a onclick={() => onDelete(project)}>
						<IconTrashRegular class="text-lg" />
						{$content.deleteProject}
					</a>
				</li>
			</ul>
		</div>
	</div>

	<footer class="mt-auto row justify-between items-end w-full">
		<div class="col grow gap-1 text-start">
			<div class="text-4xl font-bold">{project.clientName}</div>
			<div class="text-lg text-base-content/70">{project.domain}</div>
		</div>

		<div class="col gap-2 text-end">
			{#each project.leaders as leader, index (leader.email)}
				<span class="row items-center gap-2 text-sm font-medium">
					<Avatar user={leader as unknown as User} size="mini" />
					{leader.firstName}
					{leader.lastName}
				</span>
			{/each}
		</div>
	</footer>
</button>

<style>
	.ProjectCard {
		height: 20rem;
		background: var(--color-base-200);
	}
</style>

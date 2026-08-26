<script lang="ts">
	import { goto } from "$app/navigation";
	import { projectTypes } from "$lib/i18n/contents/projects";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { formatPercent } from "$lib/numbers/formatPercent";
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
	import Trend from "./Trend.svelte";

	const content = defineContent({
		en: {
			updateProject: "Update project",
			deleteProject: "Delete project",
			confirmDeleteProject: (name: string) =>
				`Are you sure you want to delete the project "${name}"?`,
			positionnedKeywords: "Positionned keywords",
			shareOfVoice: "Share of voice",
		},
		fr: {
			updateProject: "Modifier le projet",
			deleteProject: "Supprimer le projet",
			confirmDeleteProject: (name: string) =>
				`Êtes-vous certain de vouloir supprimer le projet "${name}" ?`,
			positionnedKeywords: "Mots-clés positionnés",
			shareOfVoice: "Part de voix",
		},
	});

	let {
		project,
		onEdit = (project) => context.openProjectDialog?.(project),
		onDelete = (project) =>
			context.openConfirmDialog?.({
				title: $content.confirmDeleteProject(project.name),
				then: () => deleteProject(project.id),
			}),
	}: {
		project: ProjectInfo;
		onEdit?: (project: ProjectInfo) => void;
		onDelete?: (project: ProjectInfo) => void;
	} = $props();

	const analysisData = $derived(
		project.analysis?.data.find((item) => item.domain === project.domain),
	);
</script>

<button
	class="ProjectCard card card-hover cursor-pointer px-6! py-5! col! justify-stretch items-start bg-gray-1"
	onclick={() => goto(`/projects/${project.id}/share-of-voice`)}
>
	<div class="row justify-between w-full">
		<div
			class="badge bg-base-300! px-2! py-1.5!"
			style:border="1px solid var(--color-border)"
		>
			{$projectTypes[project.type]}
		</div>

		{#if context.user?.role === "admin" || context.user?.role === "project_manager"}
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
		{/if}
	</div>

	<footer class="mt-auto col gap-2 w-full">
		<div class="row gap-x-3 gap-y-2 flex-wrap">
			{#each project.leaders as leader, index (leader.email)}
				<span class="row items-center gap-2 text-sm font-medium">
					<Avatar user={leader as unknown as User} size="mini" />
					{leader.firstName}
					{leader.lastName}
				</span>
			{/each}
		</div>

		<div class="ProjectIdentity row justify-between items-end gap-4 w-full text-start">
			<div class="col grow gap-1 min-w-0">
				<div class="ProjectName text-4xl font-bold">{project.name}</div>
				<div class="ProjectDomain text-md text-base-content/70">{project.domain}</div>
			</div>

			<div class="Client col gap-1 shrink-0 text-end">
				<div class="ClientName text-md font-bold">{project.clientName}</div>
			</div>
		</div>

		<hr class="w-full" style:margin-block="4px" />

		<div class="col items-stretch gap-1 rounded-[1.25rem] font-bold">
			<div class="row justify-between">
				<div class="text-sm">{$content.positionnedKeywords}</div>
				<div class="text-sm">
					{#if project.analysis && analysisData}
						{analysisData.positionnedKeywordCount}
						/
						{project.analysis.keywordCount}
					{:else}
						<span class="w-5"> - </span>
					{/if}
				</div>
			</div>

			<div class="row justify-between">
				<div class="text-sm">{$content.shareOfVoice}</div>
				<div class="center gap-2">
					<div class="text-sm">
						{#if project.analysis && analysisData}
							{formatPercent(
								analysisData.volume / project.analysis.totalVolume,
							)}
						{:else}
							<span class="w-5"> - </span>
						{/if}
					</div>
					<Trend trend={analysisData?.trend} />
				</div>
			</div>
		</div>
	</footer>
</button>

<style>
	.ProjectCard {
		height: 20rem;
		border-color: var(--input);
		background: var(--color-base-200);
	}

	.ProjectCard hr {
		border-color: var(--input);
	}

	.ProjectName,
	.ProjectDomain,
	.ClientName {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ProjectName {
		line-height: normal;
	}

	.Client {
		max-width: 40%;
	}
</style>

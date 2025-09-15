<script lang="ts">
	import { projectTypes } from "$lib/i18n/contents/projects";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { Project } from "$lib/server/db/schema";
	import IconDotsThreeVerticalRegular from "phosphor-icons-svelte/IconDotsThreeVerticalRegular.svelte";

	const content = defineContent({
		en: {
			updateProject: "Update project",
			deleteProject: "Delete project",
		},
		fr: {
			updateProject: "Modifier le projet",
			deleteProject: "Supprimer le projet",
		},
	});

	let { project }: { project: Project } = $props();
</script>

<div class="ProjectCard card px-6 py-5">
	<div class="row justify-between w-full">
		<div class="row center bg-base-100 px-3 h-7 rounded-sm bold text-sm">
			{$projectTypes[project.type]}
		</div>

		<div class="dropdown dropdown-bottom dropdown-end">
			<div tabindex="0" role="button" class="cursor-pointer p-1">
				<IconDotsThreeVerticalRegular class="text-2xl" />
			</div>
			<ul
				tabindex="0"
				class="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
			>
				<li><a>Item 1</a></li>
				<li><a>Item 2</a></li>
			</ul>
		</div>
	</div>

	<footer></footer>
</div>

<style>
	.ProjectCard {
		height: 20rem;
		background: #f8f8f8;
	}
</style>

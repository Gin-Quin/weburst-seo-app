<script lang="ts">
	import Loader from "$lib/components/Loader.svelte";
	import ProjectCard from "$lib/components/ProjectCard.svelte";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { context } from "$lib/stores/context.svelte";
	import { listProjects } from "../(api)/projects.remote";

	const content = defineContent({
		en: {
			allProjects: "All projects",
			myProjects: "My projects",
			noProjects: "No projects found.",
		},
		fr: {
			allProjects: "Tous les projets",
			myProjects: "Mes projets",
			noProjects: "Aucun projet trouvé.",
		},
	});
</script>

<div class="px-10 py-8">
	<main class="col gap-5 bg-base-100 px-10 py-8 rounded-[1.25rem]">
		<header class="PageHeader col gap-1 justify-center h-[5rem] text-2xl bold">
			{context.user!.role === "admin"
				? $content.allProjects
				: $content.myProjects}
		</header>

		<div class="projects">
			{#await listProjects({})}
				<Loader />
			{:then projects}
				{#if projects.length == 0}
					<p>{$content.noProjects}</p>
				{:else}
					{#each projects as project (project.id)}
						<ProjectCard {project} />
					{/each}
				{/if}
			{/await}
		</div>
	</main>
</div>

<style>
	.PageHeader {
		border-bottom: 1px solid var(--color-border);
	}

	.projects {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: 1.25rem;
	}
</style>

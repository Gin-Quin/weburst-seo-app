<script lang="ts">
	import ProjectCard from "$lib/components/ProjectCard.svelte";
	import { fuzzyMatch } from "$lib/search/fuzzyMatch";
	import { context } from "$lib/stores/context.svelte";
	import IconMagnifyingGlassRegular from "phosphor-icons-svelte/IconMagnifyingGlassRegular.svelte";
	import IconPlusRegular from "phosphor-icons-svelte/IconPlusRegular.svelte";

	let search = $state("");
	let clientId = $state("");
	let projectManagerId = $state("");

	const projectManagers = $derived.by(() => {
		const managers = (context.projects ?? []).flatMap(({ leaders }) => leaders);
		return [...new Map(managers.map((manager) => [manager.id, manager])).values()].sort(
			(a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
		);
	});
	const filteredProjects = $derived.by(() =>
		[...(context.projects ?? [])]
			.filter((project) =>
				fuzzyMatch(search, [project.name, project.clientName, project.domain]),
			)
			.filter((project) => !clientId || project.clientId === clientId)
			.filter(
				(project) =>
					!projectManagerId || project.leaders.some(({ id }) => id === projectManagerId),
			)
			.sort((a, b) => {
				const recency =
					(context.projectLastOpened[b.id] ?? 0) -
					(context.projectLastOpened[a.id] ?? 0);
				return recency || a.name.localeCompare(b.name);
			}),
	);
</script>

<div class="PageWrap">
	<section class="ProjectsPage">
		<header class="PageHeader">
			<div>
				<h1>Mes projets</h1>
			</div>
			{#if context.user?.role === "admin" || context.user?.role === "project_manager"}
				<button class="btn btn-primary" onclick={() => context.openProjectDialog?.()}>
					<IconPlusRegular class="icon" />
					Nouveau projet
				</button>
			{/if}
		</header>

		<div
			class:FiltersWithClient={context.user?.role === "admin" || context.user?.role === "project_manager"}
			class="Filters"
			aria-label="Filtres des projets"
		>
			<label class="input control-size-1 SearchFilter w-full">
				<IconMagnifyingGlassRegular />
				<input bind:value={search} placeholder="Nom du projet ou domaine" />
			</label>

			{#if context.user?.role === "admin" || context.user?.role === "project_manager"}
				<select
					class="select control-size-1 w-full"
					bind:value={clientId}
					aria-label="Client"
				>
					<option value="">Tous les clients</option>
					{#each context.clients ?? [] as client (client.id)}
						<option value={client.id}>{client.name}</option>
					{/each}
				</select>
			{/if}

			{#if context.user?.role === "admin"}
				<select
					class="select control-size-1 w-full"
					bind:value={projectManagerId}
					aria-label="Chef de projet"
				>
					<option value="">Tous les chefs de projet</option>
					{#each projectManagers as manager (manager.id)}
						<option value={manager.id}>
							{manager.firstName} {manager.lastName}
						</option>
					{/each}
				</select>
			{/if}
		</div>

		<p class="ResultCount">
			{filteredProjects.length} projet{filteredProjects.length === 1 ? "" : "s"}
		</p>

		<div class="Projects">
			{#if filteredProjects.length === 0}
				<div class="EmptyState">Aucun projet ne correspond à ces filtres.</div>
			{:else}
				{#each filteredProjects as project (project.id)}
					<ProjectCard {project} />
				{/each}
			{/if}
		</div>
	</section>
</div>

<style>
	.PageWrap { padding: 2rem 2.5rem; }
	.ProjectsPage { display: flex; flex-direction: column; gap: 1.25rem; padding: 2rem 2.5rem; border: 1px solid var(--color-border); border-radius: 1.25rem; background: var(--color-base-100); }
	.PageHeader { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
	h1 { font-size: 1.75rem; font-weight: 700; }
	.Filters { display: grid; grid-template-columns: minmax(16rem, 1fr); gap: 0.75rem; }
	.FiltersWithClient { grid-template-columns: minmax(16rem, 2fr) repeat(2, minmax(12rem, 1fr)); }
	.SearchFilter { display: flex; align-items: center; gap: 0.65rem; }
	.SearchFilter :global(svg) { width: 1.25rem; height: 1.25rem; flex: 0 0 auto; }
	.SearchFilter input { min-width: 0; width: 100%; background: transparent; }
	.ResultCount { color: var(--color-text-light); font-size: 0.875rem; }
	.Projects { display: grid; grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr)); gap: 1.25rem; }
	.EmptyState { grid-column: 1 / -1; padding: 3rem; border: 1px dashed var(--color-border); border-radius: 1rem; color: var(--color-text-light); text-align: center; }
	@media (max-width: 960px) { .Filters { grid-template-columns: 1fr; } }
	@media (max-width: 720px) {
		.PageWrap, .ProjectsPage { padding: 1rem; }
		.PageHeader { align-items: flex-start; flex-direction: column; }
		.Projects { grid-template-columns: minmax(0, 1fr); }
	}
</style>

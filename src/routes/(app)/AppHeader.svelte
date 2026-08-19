<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import WeBurstLogo from "$lib/assets/images/WeBurst.png";
	import WeBurstMark from "$lib/assets/images/WeBurstMark.png";
	import { context } from "$lib/stores/context.svelte";
	import { getProjectPath } from "$lib/projects/getProjectPath";
	import IconCaretDownRegular from "phosphor-icons-svelte/IconCaretDownRegular.svelte";
	import IconMagnifyingGlassRegular from "phosphor-icons-svelte/IconMagnifyingGlassRegular.svelte";
	import IconPlusRegular from "phosphor-icons-svelte/IconPlusRegular.svelte";

	let search = $state("");
	let searchFocused = $state(false);
	const selectedClientId = $derived(context.project?.clientId ?? "");

	const clientProjects = $derived(
		selectedClientId
			? (context.projects?.filter(
					({ clientId }) => clientId === selectedClientId,
				) ?? [])
			: [],
	);
	const selectedClient = $derived(
		context.clients?.find(({ id }) => id === selectedClientId),
	);
	const selectedProject = $derived(
		context.project?.clientId === selectedClientId ? context.project : undefined,
	);
	const searchResults = $derived(
		search.trim().length < 2
			? []
			: (context.projects ?? [])
					.filter((project) => {
						const query = search.trim().toLocaleLowerCase();
						return `${project.clientName} ${project.domain}`
							.toLocaleLowerCase()
							.includes(query);
					})
					.slice(0, 6),
	);

	function projectPath(projectId: string) {
		return getProjectPath(projectId, page.url.pathname);
	}

	async function openProject(projectId: string) {
		search = "";
		searchFocused = false;
		await goto(`/projects/${projectId}/share-of-voice`);
	}
</script>

<header class="AppHeader">
	<a href="/" class="Logo" aria-label="Accueil">
		<img class="FullLogo" src={WeBurstLogo} alt="" />
		<img class="LogoMark" src={WeBurstMark} alt="" />
	</a>

	<div class="HeaderContent">
		<div class="SearchWrap">
			<label class="Search" aria-label="Rechercher un projet ou un contenu">
				<IconMagnifyingGlassRegular />
				<input
					bind:value={search}
					onfocus={() => (searchFocused = true)}
					onblur={() => setTimeout(() => (searchFocused = false), 120)}
					placeholder="Rechercher un projet, un contenu..."
				/>
			</label>

			{#if searchFocused && search.length >= 2}
				<div class="SearchResults">
					{#if searchResults.length === 0}
						<p>Aucun projet trouvé.</p>
					{:else}
						{#each searchResults as project (project.id)}
							<button onclick={() => openProject(project.id)}>
								<span>{project.clientName}</span>
								<small>{project.domain}</small>
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		{#if context.project}
			<div class="HeaderSelectors">
				<div class="dropdown dropdown-bottom dropdown-end ProjectSwitcher">
					<button
						tabindex="0"
						class="btn control-size-3 CurrentProject"
						aria-label="Changer de projet"
					>
						<span class="ProjectMark">
							{selectedProject?.domain.slice(0, 1).toLocaleUpperCase() ?? "P"}
						</span>
						<span class="ProjectName">{selectedProject?.domain ?? "Choisir un projet"}</span>
						<IconCaretDownRegular class="Caret" />
					</button>

					<ul
						tabindex="0"
						class="dropdown-content menu bg-base-100 rounded-box z-20 mt-2 w-[19rem] shadow-md"
					>
						<li class="ClientName">{selectedClient?.name ?? context.project.clientName}</li>
						{#each clientProjects as project (project.id)}
							<li>
								<a
									href={projectPath(project.id)}
									class:menu-active={project.id === context.project?.id}
								>
									{project.domain}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		{:else if context.user?.role === "admin"}
			<button
				class="btn control-size-2"
				onclick={() => context.openUserDialog?.("create")}
			>
				<IconPlusRegular class="icon" />
				Nouvel utilisateur
			</button>
		{/if}
	</div>
</header>

<style>
	.AppHeader {
		grid-column: 1 / -1;
		grid-row: 1;
		position: sticky;
		top: 0;
		display: grid;
		grid-template-columns: var(--app-sidebar-width) minmax(0, 1fr);
		background: var(--color-base-100);
		border-bottom: 1px solid var(--color-border);
		z-index: 30;
	}

	.Logo {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem 2rem;
		border-right: 1px solid var(--color-border);
	}

	.FullLogo {
		width: min(12.75rem, 100%);
		height: auto;
	}

	.LogoMark {
		display: none;
	}

	.HeaderContent {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
		padding: 1.25rem 2rem;
	}

	.SearchWrap {
		position: relative;
		width: min(31rem, 48%);
	}

	.Search {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 48px;
		padding: 0 1.15rem;
		border: 1px solid var(--input);
		border-radius: 0.75rem;
		background: var(--color-base-100);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.02);
	}

	.Search :global(svg) {
		flex: 0 0 auto;
		width: 1.65rem;
		height: 1.65rem;
	}

	.Search input {
		width: 100%;
		font-size: 1.05rem;
		background: transparent;
	}

	.SearchResults {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		right: 0;
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 0.75rem;
		background: var(--color-base-100);
		box-shadow: 0 0.75rem 2rem rgb(0 0 0 / 0.08);
	}

	.SearchResults p {
		padding: 0.75rem;
		color: var(--color-text-light);
	}

	.SearchResults button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.75rem;
		border-radius: 0.5rem;
		cursor: pointer;
	}

	.SearchResults button:hover {
		background: var(--color-gray-1);
	}

	.SearchResults small {
		color: var(--color-text-light);
	}

	.HeaderSelectors {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}

	.CurrentProject {
		display: grid;
		grid-template-columns: 40px minmax(0, 1fr) 1.25rem;
		align-items: center;
		gap: 1rem;
		min-width: 19.5rem;
		padding-inline: 0.5rem;
		font-weight: 700;
		cursor: pointer;
	}

	.ProjectMark {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 9999px;
		background: #ffc0c2;
		color: #8f3439;
		font-size: 1.25rem;
	}

	.ProjectName {
		overflow: hidden;
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.Caret) {
		transition: transform 120ms ease;
	}

	.ProjectSwitcher:focus-within :global(.Caret) {
		transform: rotate(180deg);
	}

	.ClientName {
		padding: 0.75rem 1rem 0.5rem;
		color: var(--color-text-light);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	@media (max-width: 1100px) {
		.Logo {
			justify-content: center;
			padding: 1rem;
		}

		.FullLogo {
			display: none;
		}

		.LogoMark {
			display: block;
			width: 3rem;
			height: 3rem;
		}

		.HeaderContent {
			padding-inline: 1rem;
		}

		.SearchWrap {
			width: min(28rem, 55%);
		}

		.CurrentProject {
			min-width: 15rem;
		}
	}

	@media (max-width: 640px) {
		.HeaderContent {
			gap: 0.75rem;
		}

		.SearchWrap {
			width: 100%;
		}

		.Search input {
			font-size: 0.9rem;
		}

		.CurrentProject {
			grid-template-columns: 40px 1.25rem;
			min-width: auto;
			gap: 0.5rem;
		}

		.ProjectName {
			display: none;
		}
	}
</style>

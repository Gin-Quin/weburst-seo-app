<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import Avatar from "$lib/components/Avatar.svelte";
	import { canViewProjectContents } from "$lib/contents/access";
	import { context } from "$lib/stores/context.svelte";
	import IconArrowLeftRegular from "phosphor-icons-svelte/IconArrowLeftRegular.svelte";
	import IconBuildingsRegular from "phosphor-icons-svelte/IconBuildingsRegular.svelte";
	import IconCirclesThreeRegular from "phosphor-icons-svelte/IconCirclesThreeRegular.svelte";
	import IconFileTextRegular from "phosphor-icons-svelte/IconFileTextRegular.svelte";
	import IconFolderOpenRegular from "phosphor-icons-svelte/IconFolderOpenRegular.svelte";
	import IconGearRegular from "phosphor-icons-svelte/IconGearRegular.svelte";
	import IconPlugsConnectedRegular from "phosphor-icons-svelte/IconPlugsConnectedRegular.svelte";
	import IconSignOutRegular from "phosphor-icons-svelte/IconSignOutRegular.svelte";
	import IconWaveSineRegular from "phosphor-icons-svelte/IconWaveSineRegular.svelte";
	import { clearServerSession } from "../api/login.remote";

	const projectId = $derived(page.params.projectId);
	const isProjectDetail = $derived(
		/^\/projects\/[^/]+/.test(page.url.pathname),
	);
	const canViewContents = $derived(
		(context.project?.contentWritingEnabled ?? true) &&
			canViewProjectContents(context.user?.role, context.project?.type),
	);
	const canViewShareOfVoice = $derived(
		context.project?.shareOfVoiceEnabled ?? true,
	);

	async function logout() {
		try {
			await clearServerSession();
		} catch (error) {
			console.error("Failed to clear the server session", error);
		} finally {
			localStorage.removeItem("bearer");
			localStorage.removeItem("user");
			context.user = null;
			await goto("/login");
		}
	}
</script>

<aside class="Sidebar">
	<nav class="PrimaryNavigation" aria-label="Navigation principale">
		{#if isProjectDetail && projectId}
			<a
				href="/projects"
				class="BackToProjects"
				aria-label="Retour vers mes projets"
			>
				<IconArrowLeftRegular />
				<span>Mes projets</span>
			</a>

			<hr />

			{#if canViewShareOfVoice}
				<a
					href={`/projects/${projectId}/share-of-voice`}
					class:active={page.url.pathname.endsWith("/share-of-voice")}
					aria-label="Part de voix"
				>
					<IconCirclesThreeRegular />
					<span>Part de voix</span>
				</a>

				<a
					href={`/projects/${projectId}/keyword-similarities`}
					class:active={page.url.pathname.endsWith("/keyword-similarities")}
					aria-label="Similarité"
				>
					<IconWaveSineRegular />
					<span>Similarité</span>
				</a>
			{/if}

			{#if canViewContents}
				<a
					href={`/projects/${projectId}/contents`}
					class:active={page.url.pathname ===
						`/projects/${projectId}/contents` ||
						page.url.pathname.startsWith(`/projects/${projectId}/contents/`)}
					aria-label="Contenus"
				>
					<IconFileTextRegular />
					<span>Contenus</span>
				</a>
			{/if}
		{:else}
			{#if context.user?.role === "admin"}
				<a
					href="/projects"
					class:active={page.url.pathname === "/projects"}
					aria-label="Mes projets"
				>
					<IconFolderOpenRegular />
					<span>Mes projets</span>
				</a>

				<a
					href="/clients"
					class:active={page.url.pathname.startsWith("/clients")}
					aria-label="Mes clients"
				>
					<IconBuildingsRegular />
					<span>Mes clients</span>
				</a>
			{/if}
		{/if}
	</nav>

	<div class="SidebarFooter">
		<nav class="AccountNavigation" aria-label="Navigation du compte">
			<a
				href="/settings/account"
				class:active={page.url.pathname.startsWith("/settings/account")}
				aria-label="Paramètres"
			>
				<IconGearRegular />
				<span>Paramètres</span>
			</a>

			<a
				href="/settings/mcp"
				class:active={page.url.pathname.startsWith("/settings/mcp")}
				aria-label="Connexion MCP"
			>
				<IconPlugsConnectedRegular />
				<span>Connexion MCP</span>
			</a>

			<button type="button" onclick={logout} aria-label="Se déconnecter">
				<IconSignOutRegular />
				<span>Se déconnecter</span>
			</button>
		</nav>

		{#if context.user}
			<div class="UserCard" aria-label="Profil de l’utilisateur">
				<Avatar />
				<span class="UserDetails">
					<strong>{context.user.firstName} {context.user.lastName}</strong>
					<small>{context.user.email}</small>
				</span>
			</div>
		{/if}
	</div>
</aside>

<style>
	.Sidebar {
		grid-column: 1;
		grid-row: 2;
		position: sticky;
		top: var(--app-header-height);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		height: calc(100dvh - var(--app-header-height));
		width: var(--app-sidebar-width);
		padding: 2rem 0.65rem 1rem;
		border-right: 1px solid var(--color-border);
		background: var(--color-base-100);
		overflow: hidden;
		z-index: 20;
		transition:
			width 160ms cubic-bezier(0.22, 1, 0.36, 1),
			box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.PrimaryNavigation,
	.AccountNavigation {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}

	.PrimaryNavigation a,
	.AccountNavigation a,
	.AccountNavigation button {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 1rem;
		height: 48px;
		width: 48px;
		margin-left: 0.6rem;
		padding: 0 0.75rem;
		border: 1px solid transparent;
		border-radius: 1rem;
		background: transparent;
		color: #11182d;
		font-family: inherit;
		font-size: 1rem;
		font-weight: 500;
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
		transition:
			width 160ms cubic-bezier(0.22, 1, 0.36, 1),
			background 150ms ease,
			border-color 150ms ease,
			color 150ms ease;
	}

	.PrimaryNavigation a:hover:not(.disabled),
	.AccountNavigation a:hover,
	.AccountNavigation button:hover {
		background: var(--color-gray-1);
	}

	.PrimaryNavigation a.active,
	.AccountNavigation a.active {
		border-color: hsl(from var(--color-primary) h 100% 85.294%);
		background: hsl(from var(--color-primary) h 100% 98.039%);
		color: hsl(from var(--color-primary) h 76.404% 34.902%);
	}

	.PrimaryNavigation hr {
		width: 100%;
		margin: 0.75rem 0;
		border: 0;
		border-top: 1px solid var(--color-border);
	}

	.BackToProjects {
		color: var(--color-text-light);
	}

	.PrimaryNavigation :global(svg),
	.AccountNavigation :global(svg) {
		flex: 0 0 auto;
		width: 24px;
		height: 24px;
		stroke-width: 1.7;
	}

	.AccountNavigation a,
	.AccountNavigation button {
		font-size: calc(1rem - 2px);
	}

	.AccountNavigation :global(svg) {
		width: 22px;
		height: 22px;
	}

	.SidebarFooter {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
	}

	.UserCard {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.8rem;
		height: 4.2rem;
		width: 100%;
		padding: 0.35rem;
		border: 0;
		border-radius: 1.25rem;
		background: var(--color-base-100);
	}

	.UserDetails {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1.25;
	}

	.UserDetails strong,
	.UserDetails small {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.UserDetails small {
		color: var(--color-text-light);
	}

	.PrimaryNavigation a span,
	.AccountNavigation span,
	.UserDetails {
		display: none;
	}

	@media (min-width: 1101px) and (hover: hover) {
		.Sidebar:hover,
		.Sidebar:focus-within {
			width: var(--app-sidebar-expanded-width);
			box-shadow: 0.75rem 0 1.5rem rgb(17 24 39 / 0.08);
		}

		.Sidebar:hover .PrimaryNavigation a,
		.Sidebar:hover .AccountNavigation a,
		.Sidebar:hover .AccountNavigation button,
		.Sidebar:focus-within .PrimaryNavigation a,
		.Sidebar:focus-within .AccountNavigation a,
		.Sidebar:focus-within .AccountNavigation button {
			width: calc(100% - 0.6rem);
		}

		.Sidebar:hover .PrimaryNavigation a span,
		.Sidebar:hover .AccountNavigation span,
		.Sidebar:hover .UserDetails,
		.Sidebar:focus-within .PrimaryNavigation a span,
		.Sidebar:focus-within .AccountNavigation span,
		.Sidebar:focus-within .UserDetails {
			display: flex;
		}

		.Sidebar:hover .UserCard,
		.Sidebar:focus-within .UserCard {
			display: grid;
			grid-template-columns: auto minmax(0, 1fr);
			justify-content: initial;
		}
	}

	@media (max-width: 640px) {
		.Sidebar {
			padding: 1rem 0.4rem 0.75rem;
		}
	}
</style>

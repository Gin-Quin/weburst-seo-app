<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import Avatar from "$lib/components/Avatar.svelte";
	import { context } from "$lib/stores/context.svelte";
	import IconArrowLeftRegular from "phosphor-icons-svelte/IconArrowLeftRegular.svelte";
	import IconBuildingsRegular from "phosphor-icons-svelte/IconBuildingsRegular.svelte";
	import IconCirclesThreeRegular from "phosphor-icons-svelte/IconCirclesThreeRegular.svelte";
	import IconFileTextRegular from "phosphor-icons-svelte/IconFileTextRegular.svelte";
	import IconFolderOpenRegular from "phosphor-icons-svelte/IconFolderOpenRegular.svelte";
	import IconGearRegular from "phosphor-icons-svelte/IconGearRegular.svelte";
	import IconSignOutRegular from "phosphor-icons-svelte/IconSignOutRegular.svelte";
	import IconWaveSineRegular from "phosphor-icons-svelte/IconWaveSineRegular.svelte";
	import { clearServerSession } from "../api/login.remote";

	const projectId = $derived(page.params.projectId);
	const isProjectDetail = $derived(
		/^\/projects\/[^/]+/.test(page.url.pathname),
	);

	async function logout() {
		void clearServerSession();
		localStorage.removeItem("bearer");
		localStorage.removeItem("user");
		context.user = null;
		await goto("/login");
	}
</script>

<aside class="Sidebar">
	<nav aria-label="Navigation principale">
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

			<a
				href={`/projects/${projectId}/contents`}
				class:active={page.url.pathname.endsWith("/contents")}
				aria-label="Contenu"
			>
				<IconFileTextRegular />
				<span>Contenu</span>
			</a>
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

	<div class="dropdown dropdown-top dropdown-center card-hover-group SidebarUser">
		<button tabindex="0" class="UserCard card-hover" aria-label="Menu du compte">
			<Avatar />
			<span class="UserDetails">
				<strong>{context.user!.firstName} {context.user!.lastName}</strong>
				<small>{context.user!.email}</small>
			</span>
		</button>

		<ul
			tabindex="0"
			class="dropdown-content menu bg-base-100 rounded-box z-20 w-64 shadow-md"
		>
			<li>
				<button onclick={() => context.openUserDialog?.("account")}>
					<IconGearRegular />
					Paramètres
				</button>
			</li>
			<li>
				<button onclick={logout}>
					<IconSignOutRegular />
					Se déconnecter
				</button>
			</li>
		</ul>
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
		padding: 2rem 0.75rem 1rem;
		border-right: 1px solid var(--color-border);
		background: var(--color-base-100);
		z-index: 20;
	}

	nav {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	nav a {
		display: flex;
		align-items: center;
		gap: 1rem;
		height: 48px;
		padding: 0 1.35rem;
		border: 1px solid transparent;
		border-radius: 1rem;
		color: #11182d;
		font-size: 1rem;
		font-weight: 500;
		white-space: nowrap;
		transition:
			background 150ms ease,
			border-color 150ms ease,
			color 150ms ease;
	}

	nav a:hover:not(.disabled) {
		background: var(--color-gray-1);
	}

	nav a.active {
		border-color: #b4cbff;
		background: #f5f8ff;
		color: #153a9d;
	}

	nav hr {
		width: 100%;
		margin: 0.75rem 0;
		border: 0;
		border-top: 1px solid var(--color-border);
	}

	.BackToProjects {
		color: var(--color-text-light);
	}

	nav :global(svg) {
		flex: 0 0 auto;
		width: 24px;
		height: 24px;
		stroke-width: 1.7;
	}

	.SidebarUser {
		width: 100%;
	}

	.UserCard {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.8rem;
		width: 100%;
		padding: 0.55rem;
		border: 1px solid var(--color-border);
		border-radius: 1.25rem;
		background: var(--color-base-100);
		cursor: pointer;
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

	.SidebarUser .dropdown-content {
		margin-bottom: 0.75rem;
	}

	@media (max-width: 1100px) {
		.Sidebar {
			padding-inline: 0.65rem;
		}

		.SidebarUser {
			--anchor-h: span-right;
		}

		.SidebarUser .dropdown-content {
			inset-inline-end: auto;
			translate: 0;
		}

		nav {
			align-items: center;
		}

		nav a {
			justify-content: center;
			width: 48px;
			padding: 0;
		}

		nav a span,
		.UserDetails {
			display: none;
		}

		.UserCard {
			display: flex;
			justify-content: center;
			padding: 0.35rem;
			border: 0;
		}
	}

	@media (max-width: 640px) {
		.Sidebar {
			padding: 1rem 0.4rem 0.75rem;
		}
	}
</style>

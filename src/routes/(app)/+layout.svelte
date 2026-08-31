<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import Loader from "$lib/components/Loader.svelte";
	import { context, setContextUser } from "$lib/stores/context.svelte";
	import { cubicIn } from "svelte/easing";
	import { fade } from "svelte/transition";
	import { listClients } from "../api/clients.remote";
	import { getCurrentUser } from "../api/login.remote";
	import { listProjects } from "../api/projects.remote";
	import AppHeader from "./AppHeader.svelte";
	import AppSidebar from "./AppSidebar.svelte";
	import ConfirmDialog from "./ConfirmDialog.svelte";
	import ProjectDialog from "./ProjectDialog.svelte";
	import UserDialog from "./UserDialog.svelte";

	let { children } = $props();

	let projectId = $state<string | undefined>();
	let loading = $state(true);
	let lastOpenedLoaded = $state(false);
	let lastTrackedProjectId: string | undefined;
	const projectLastOpenedKey = "project-last-opened";

	$effect(() => {
		if (context.user) {
			Promise.all([listClients(), listProjects()]).then(
				([clients, projects]) => {
					context.clients = clients;
					context.projects = projects;
				},
			);
		}
	});

	$effect(() => {
		const path = page.url.pathname.split("/");
		if (path[1] == "projects" && path[2]) {
			projectId = path[2];
		} else {
			projectId = undefined;
		}
	});

	$effect(() => {
		context.project = projectId
			? context.projects?.find(({ id }) => id === projectId)
			: undefined;
	});

	$effect(() => {
		if (
			projectId &&
			context.projects &&
			!context.projects.some(({ id }) => id === projectId)
		) {
			void goto("/projects", { replaceState: true });
		}
	});

	$effect(() => {
		if (!context.user || lastOpenedLoaded) return;
		try {
			context.projectLastOpened = JSON.parse(
				localStorage.getItem(projectLastOpenedKey) ?? "{}",
			);
		} catch {
			context.projectLastOpened = {};
		}
		lastOpenedLoaded = true;
	});

	$effect(() => {
		if (!lastOpenedLoaded || !projectId || projectId === lastTrackedProjectId)
			return;
		lastTrackedProjectId = projectId;
		context.projectLastOpened = {
			...context.projectLastOpened,
			[projectId]: Date.now(),
		};
		localStorage.setItem(
			projectLastOpenedKey,
			JSON.stringify(context.projectLastOpened),
		);
	});

	$effect(() => {
		if (context.user) {
			if (context.clients && context.projects) {
				loading = false;
			}
		} else if (!localStorage.getItem("bearer")) {
			goto("/login");
		} else if (!localStorage.getItem("user")) {
			getCurrentUser().then((user) => {
				if (!user) {
					localStorage.removeItem("bearer");
					goto("/login");
				} else {
					setContextUser(user);
				}
			});
		} else {
			context.user = JSON.parse(localStorage.getItem("user")!);
		}
	});
</script>

<ConfirmDialog bind:openConfirmDialog={context.openConfirmDialog} />

{#if loading || !context.user}
	<Loader class="h-[100dvh] center" />
{:else}
	<ProjectDialog bind:openProjectDialog={context.openProjectDialog} />
	<UserDialog bind:openUserDialog={context.openUserDialog} />

	<div class="AppShell" in:fade={{ duration: 400, easing: cubicIn }}>
		<AppHeader />
		<AppSidebar />

		<main class="AppContent">
			{@render children()}
		</main>
	</div>
{/if}

<style>
	:global(:root) {
		--app-header-height: 5rem;
		--app-sidebar-width: 5.5rem;
		--app-sidebar-expanded-width: 18rem;
	}

	.AppShell {
		display: grid;
		grid-template-columns: var(--app-sidebar-width) minmax(0, 1fr);
		grid-template-rows: var(--app-header-height) minmax(
				calc(100dvh - var(--app-header-height)),
				auto
			);
		min-height: 100dvh;
		background: var(--color-background);
	}

	.AppContent {
		grid-column: 2;
		grid-row: 2;
		min-width: 0;
		min-height: calc(100dvh - var(--app-header-height));
	}

	@media (max-width: 640px) {
		:global(:root) {
			--app-header-height: 5rem;
			--app-sidebar-width: 4.75rem;
		}
	}
</style>

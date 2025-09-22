<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import Loader from "$lib/components/Loader.svelte";
	import { context, setContextUser } from "$lib/stores/context.svelte";
	import { cubicIn } from "svelte/easing";
	import { fade } from "svelte/transition";
	import { getCurrentUser } from "../api/login.remote";
	import { listProjects } from "../api/projects.remote";
	import AppHeader from "./AppHeader.svelte";
	import ConfirmDialog from "./ConfirmDialog.svelte";
	import ProjectDialog from "./ProjectDialog.svelte";
	import UserDialog from "./UserDialog.svelte";

	let { children } = $props();

	let projectId = $state<string | undefined>();
	let loading = $state(true);

	$effect(() => {
		if (context.user) {
			listProjects().then((projects) => {
				context.projects = projects;
			});
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
		if (context.user) {
			if (context.projects) {
				loading = false;
			}
		} else if (!localStorage.getItem("bearer")) {
			goto("/login");
		} else if (!localStorage.getItem("user")) {
			getCurrentUser().then((user) => {
				if (!user) {
					console.log("User from bearer not found");
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

{#if loading}
	<Loader class="h-[100dvh] center" />
{:else}
	<ProjectDialog bind:openProjectDialog={context.openProjectDialog} />
	<UserDialog bind:openUserDialog={context.openUserDialog} />

	<div
		in:fade={{ duration: 400, easing: cubicIn }}
		style:--app-header-height="6rem"
	>
		<AppHeader />

		<main>
			{@render children()}
		</main>
	</div>
{/if}

<style>
	main {
		min-height: calc(100dvh - var(--app-header-height));
	}
</style>

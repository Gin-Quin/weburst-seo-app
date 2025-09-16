<script lang="ts">
	import { goto } from "$app/navigation";
	import WeBurstLogo from "$lib/assets/images/WeBurst.png";
	import Avatar from "$lib/components/Avatar.svelte";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { Project } from "$lib/server/db/schema";
	import { context } from "$lib/stores/context.svelte";
	import IconCaretDownRegular from "phosphor-icons-svelte/IconCaretDownRegular.svelte";
	import IconGearRegular from "phosphor-icons-svelte/IconGearRegular.svelte";
	import IconPlusRegular from "phosphor-icons-svelte/IconPlusRegular.svelte";
	import IconSignOutRegular from "phosphor-icons-svelte/IconSignOutRegular.svelte";
	import { clearServerSession } from "../(api)/login.remote";
	import ProjectDialog from "./ProjectDialog.svelte";
	import UserDialog from "./UserDialog.svelte";
	import { userRoles } from "$lib/i18n/contents/users";

	const content = defineContent({
		en: {
			createProject: "New project",
			createUser: "New user",
			settings: "Settings",
			logOut: "Log out",
		},
		fr: {
			createProject: "Nouveau projet",
			createUser: "Nouvel utilisateur",
			settings: "Paramètres",
			logOut: "Se déconnecter",
		},
	});

	async function logout() {
		void clearServerSession();
		localStorage.removeItem("bearer");
		localStorage.removeItem("user");
		await goto("/login");
		context.user = null;
	}
</script>

<div
	class="AppHeader h-24 row w-full justify-between items-center gap-5 px-10 bg-base-100"
>
	<img src={WeBurstLogo} alt="Weburst Logo" class="h-14" />

	<div class="Actions row items-center gap-4">
		{#if context.user!.role == "admin"}
			<button
				class="btn btn-large h-12! px-6!"
				onclick={() => context.openUserDialog?.("create")}
			>
				<IconPlusRegular class="icon" />
				{$content.createUser}
			</button>
		{/if}

		<button
			class="btn btn-primary h-12! px-6!"
			onclick={() => context.openProjectDialog?.()}
		>
			<IconPlusRegular class="icon" />
			{$content.createProject}
		</button>

		<div class="dropdown dropdown-bottom dropdown-end">
			<div
				tabindex="0"
				role="button"
				class="row center h-12 gap-3 p-1 cursor-pointer active:translate-y-[1px]"
			>
				<Avatar />

				{context.user!.firstName}
				{context.user!.lastName}

				<div class="Caret center">
					<IconCaretDownRegular class="text-md" />
				</div>
			</div>

			<ul
				tabindex="0"
				class="dropdown-content menu bg-base-100 rounded-box z-1 w-[18.75rem] shadow-md"
			>
				<header class="col gap-3 center p-4 text-light">
					<Avatar />

					<div class="col center">
						<span class="text-lg">
							{$userRoles[context.user!.role]}
						</span>
						<span class="text-md font-medium">
							{context.user!.email}
						</span>
					</div>
				</header>

				<hr class="mb-1 text-border" />

				<li>
					<a onclick={() => context.openUserDialog?.("account")}>
						<IconGearRegular class="icon" />
						{$content.settings}
					</a>
				</li>
				<li>
					<a onclick={logout}>
						<IconSignOutRegular class="icon" />
						{$content.logOut}
					</a>
				</li>
			</ul>
		</div>
	</div>
</div>

<style>
	.Caret {
		transition: transform 110ms ease-in-out;
	}

	.dropdown:focus-within .Caret {
		transform: rotate(180deg);
	}

	.dropdown-content {
		transform: translateY(0.75rem);
	}
</style>

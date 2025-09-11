<script lang="ts">
	import WeBurstLogo from "$lib/assets/images/WeBurst.png";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { context } from "$lib/stores/context.svelte";
	import { getInitials } from "$lib/strings/getInitials";
	import IconPlusRegular from "phosphor-icons-svelte/IconPlusRegular.svelte";
	import IconCaretDownRegular from "phosphor-icons-svelte/IconCaretDownRegular.svelte";
	import { clearServerSession } from "../login/actions.remote";
	import { goto } from "$app/navigation";

	const content = defineContent({
		en: {
			createProject: "New project",
			logOut: "Log out",
		},
		fr: {
			createProject: "Créer un projet",
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
		<button class="btn btn-primary h-12! px-6!">
			<IconPlusRegular class="icon" />
			{$content.createProject}
		</button>

		<div class="dropdown">
			<div
				tabindex="0"
				role="button"
				class="row center h-12 gap-3 p-1 cursor-pointer active:translate-y-[1px]"
			>
				<div class="avatar avatar-placeholder">
					<div class="bg-neutral text-neutral-content w-10 rounded-full">
						{getInitials(context.user!.firstName, context.user!.lastName)}
					</div>
				</div>

				{context.user!.firstName}
				{context.user!.lastName}

				<div class="Caret center">
					<IconCaretDownRegular class="text-md" />
				</div>
			</div>

			<ul
				tabindex="0"
				class="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
			>
				<li><a onclick={logout}>{$content.logOut}</a></li>
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
</style>

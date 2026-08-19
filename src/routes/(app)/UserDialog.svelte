<script lang="ts">
	import { userRoles } from "$lib/i18n/contents/users";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { context, setContextUser } from "$lib/stores/context.svelte";
	import IconEnvelopeRegular from "phosphor-icons-svelte/IconEnvelopeRegular.svelte";
	import IconUserCheckRegular from "phosphor-icons-svelte/IconUserCheckRegular.svelte";
	import IconUserRegular from "phosphor-icons-svelte/IconUserRegular.svelte";
	import { createUserByAdmin, updateCurrentUser } from "../api/users.remote";
	import { CreateUser, UpdateCurrentUser } from "../api/users.schema";
	import { toast } from "svelte-sonner";

	let {
		ref = $bindable(),
		openUserDialog = $bindable(),
	}: {
		ref?: HTMLDialogElement;
		openUserDialog?: (mode?: "account" | "create") => void;
	} = $props();

	const content = defineContent({
		en: {
			title: "Account Settings",
			createTitle: "Create a new user",
			firstName: "First Name",
			lastName: "Last Name",
			email: "Email Address",
			role: "Profile Type",
			save: "Save",
			create: "Create user",
			cancel: "Cancel",
			userUpdated: "Your data has been updated",
			userCreated: "User created successfully",
			userCreationFailed: "User creation failed",
			userUpdateFailed: "User update failed",
		},
		fr: {
			title: "Paramètres du compte",
			createTitle: "Créer un nouvel utilisateur",
			firstName: "Prénom",
			lastName: "Nom",
			email: "Adresse email",
			role: "Type de profil",
			save: "Enregistrer",
			create: "Créer l'utilisateur",
			cancel: "Annuler",
			userUpdated: "Vos données ont été mises à jour",
			userCreated: "Utilisateur créé avec succès",
			userCreationFailed: "Impossible de créer l'utilisateur",
			userUpdateFailed: "Impossible de mettre à jour l'utilisateur",
		},
	});
	const creatableRoles = ["admin", "project_manager"] as const;

	let createMode = $state(false);
	let updating = $state(false);
	let updates: UpdateCurrentUser = $state({
		firstName: context.user!.firstName,
		lastName: context.user!.lastName,
	});
	let newUser: CreateUser = $state({
		firstName: "",
		lastName: "",
		email: "",
		role: "project_manager",
	});

	const hasValidChanges = $derived(
		createMode
			? newUser.firstName && newUser.lastName && newUser.email && newUser.role
			: updates.firstName &&
					updates.lastName &&
					(updates.firstName !== context.user!.firstName ||
						updates.lastName !== context.user!.lastName),
	);

	openUserDialog = (mode = "account") => {
		createMode = mode === "create";
		if (createMode) {
			newUser = {
				firstName: "",
				lastName: "",
				email: "",
				role: "project_manager",
			};
		} else {
			updates.firstName = context.user!.firstName;
			updates.lastName = context.user!.lastName;
		}
		ref?.showModal();
	};

	async function save() {
		updating = true;
		if (createMode) {
			try {
				await createUserByAdmin(newUser);
				toast.success($content.userCreated, { richColors: true });
			} catch (error) {
				toast.error($content.userCreationFailed, { richColors: true });
			}
		} else {
			try {
				const response = await updateCurrentUser(updates);
				if (response) {
					setContextUser(response);
				}
				toast.success($content.userUpdated, { richColors: true });
			} catch (error) {
				toast.error($content.userUpdateFailed, { richColors: true });
			}
		}
		updating = false;
		ref?.close();
	}
</script>

<dialog bind:this={ref} class="modal">
	<div class="modal-box w-[42rem]">
		<header>
			{createMode ? $content.createTitle : $content.title}
		</header>

		<form method="dialog" class="col gap-6 items-stretch">
			{#if !createMode}
				<div class="row gap-3">
					<div class="field grow">
						<div class="field-title">{$content.firstName}</div>
						<label class="input w-full">
							<IconUserRegular class="icon" />
							<input
								class="grow"
								name="firstName"
								bind:value={updates.firstName}
								placeholder={$content.firstName}
							/>
						</label>
					</div>

					<div class="field grow">
						<div class="field-title">{$content.lastName}</div>
						<label class="input w-full">
							<IconUserRegular class="icon" />
							<input
								class="grow"
								name="lastName"
								bind:value={updates.lastName}
								placeholder={$content.lastName}
							/>
						</label>
					</div>
				</div>

				<div class="row gap-3">
					<div class="field grow">
						<div class="field-title">{$content.email}</div>
						<label class="input w-full">
							<IconEnvelopeRegular class="icon" />
							<input
								class="grow"
								name="email"
								type="email"
								value={context.user!.email}
								placeholder={$content.email}
								disabled
								required
							/>
						</label>
					</div>

					<div class="field grow">
						<div class="field-title">{$content.role}</div>
						<label class="input w-full">
							<IconUserCheckRegular class="icon" />
							<input
								class="grow"
								name="role"
								value={$userRoles[context.user!.role]}
								placeholder={$content.role}
								disabled
								required
							/>
						</label>
					</div>
				</div>
			{:else}
				<div class="grid grid-cols-2 gap-3">
					<div class="field grow">
						<div class="field-title">{$content.firstName}</div>
						<label class="input w-full">
							<IconUserRegular class="icon" />
							<input
								class="grow"
								name="firstName"
								bind:value={newUser.firstName}
								placeholder={$content.firstName}
							/>
						</label>
					</div>

					<div class="field grow">
						<div class="field-title">{$content.lastName}</div>
						<label class="input w-full">
							<IconUserRegular class="icon" />
							<input
								class="grow"
								name="lastName"
								bind:value={newUser.lastName}
								placeholder={$content.lastName}
							/>
						</label>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div class="field grow">
						<div class="field-title">{$content.email}</div>
						<label class="input w-full">
							<IconEnvelopeRegular class="icon" />
							<input
								class="grow"
								name="email"
								type="email"
								bind:value={newUser.email}
								placeholder={$content.email}
							/>
						</label>
					</div>

					<div class="field grow">
						<div class="field-title">{$content.role}</div>
						<label class="select">
							<IconUserCheckRegular class="icon" />
							<select class="select" bind:value={newUser.role}>
								{#each creatableRoles as role}
									<option value={role}>{$userRoles[role]}</option>
								{/each}
							</select>
						</label>
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-2 gap-3 pt-2">
				<button
					class="btn control-size-2"
					disabled={updating}
					type="button"
					onclick={() => ref?.close()}
				>
					{$content.cancel}
				</button>
				<button
					class="btn btn-primary"
					disabled={!hasValidChanges || updating}
					onclick={save}
					type="submit"
				>
					{createMode ? $content.create : $content.save}
				</button>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button></button>
	</form>
</dialog>

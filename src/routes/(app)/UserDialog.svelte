<script lang="ts">
	import { userRoles } from "$lib/i18n/contents/users";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { context, setContextUser } from "$lib/stores/context.svelte";
	import IconEnvelopeRegular from "phosphor-icons-svelte/IconEnvelopeRegular.svelte";
	import IconBuildingsRegular from "phosphor-icons-svelte/IconBuildingsRegular.svelte";
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
				inviteClientTitle: "Invite a client",
			firstName: "First Name",
			lastName: "Last Name",
			email: "Email Address",
			role: "Profile Type",
			client: "Client",
			selectClient: "Select a client",
			save: "Save",
			create: "Create user",
			cancel: "Cancel",
			userUpdated: "Your data has been updated",
			userCreated: "User created successfully",
			userCreationFailed: "User creation failed",
			userUpdateFailed: "User update failed",
			clientInvitationEmails: "Client invitation notifications",
			clientInvitationEmailsDescription:
				"Receive an email when a project manager invites a client.",
		},
			fr: {
				title: "Paramètres du compte",
				createTitle: "Créer un nouvel utilisateur",
				inviteClientTitle: "Inviter un client",
			firstName: "Prénom",
			lastName: "Nom",
			email: "Adresse email",
			role: "Type de profil",
			client: "Client",
			selectClient: "Choisir un client",
			save: "Enregistrer",
			create: "Créer l'utilisateur",
			cancel: "Annuler",
			userUpdated: "Vos données ont été mises à jour",
			userCreated: "Utilisateur créé avec succès",
			userCreationFailed: "Impossible de créer l'utilisateur",
			userUpdateFailed: "Impossible de mettre à jour l'utilisateur",
			clientInvitationEmails: "Notifications d’invitation client",
			clientInvitationEmailsDescription:
				"Recevoir un email lorsqu’un chef de projet invite un client.",
		},
	});
	const creatableRoles = $derived(
		context.user?.role === "admin"
			? (["admin", "project_manager", "client"] as const)
			: (["client"] as const),
	);

	let createMode = $state(false);
	let updating = $state(false);
	let updates: UpdateCurrentUser = $state({
		firstName: context.user?.firstName ?? "",
		lastName: context.user?.lastName ?? "",
		clientInvitationEmailsEnabled: context.user?.clientInvitationEmailsEnabled ?? true,
	});
	let newUser: CreateUser = $state({
		firstName: "",
		lastName: "",
		email: "",
		role: context.user?.role === "admin" ? "project_manager" : "client",
	});
	let selectedClientId = $state("");

	const hasValidChanges = $derived(
		createMode
			? newUser.firstName &&
				newUser.lastName &&
				newUser.email &&
				newUser.role &&
				(newUser.role !== "client" || selectedClientId)
			: updates.firstName &&
					updates.lastName &&
					(updates.firstName !== context.user?.firstName ||
						updates.lastName !== context.user?.lastName ||
						updates.clientInvitationEmailsEnabled !==
							context.user?.clientInvitationEmailsEnabled),
	);

	openUserDialog = (mode = "account") => {
		if (mode === "account" && !context.user) return;
		createMode = mode === "create";
		if (createMode) {
			selectedClientId = "";
			newUser = {
				firstName: "",
				lastName: "",
				email: "",
				role: context.user?.role === "admin" ? "project_manager" : "client",
			};
		} else {
			updates.firstName = context.user?.firstName ?? "";
			updates.lastName = context.user?.lastName ?? "";
			updates.clientInvitationEmailsEnabled =
				context.user?.clientInvitationEmailsEnabled ?? true;
		}
		ref?.showModal();
	};

	async function save() {
		updating = true;
		if (createMode) {
			try {
				await createUserByAdmin({
					...newUser,
					clientIds: newUser.role === "client" ? [selectedClientId] : [],
				});
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
			{createMode
				? context.user?.role === "admin"
					? $content.createTitle
					: $content.inviteClientTitle
				: $content.title}
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
								value={context.user?.email ?? ""}
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
								value={context.user ? $userRoles[context.user.role] : ""}
								placeholder={$content.role}
								disabled
								required
							/>
						</label>
					</div>
				</div>

				{#if context.user?.role === "admin"}
					<label class="row items-start gap-3 rounded-box border border-base-300 p-4">
						<input
							type="checkbox"
							class="checkbox mt-1"
							bind:checked={updates.clientInvitationEmailsEnabled}
						/>
						<span class="col gap-1">
							<strong>{$content.clientInvitationEmails}</strong>
							<small class="text-base-content/60">
								{$content.clientInvitationEmailsDescription}
							</small>
						</span>
					</label>
				{/if}
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
						<label class="select control-size-3 w-full">
							<IconUserCheckRegular class="icon" />
							<select class="select control-size-3" bind:value={newUser.role}>
								{#each creatableRoles as role}
									<option value={role}>{$userRoles[role]}</option>
								{/each}
							</select>
						</label>
					</div>
				</div>

				{#if newUser.role === "client"}
					<div class="field w-full">
						<div class="field-title">{$content.client}</div>
						<label class="select control-size-3 w-full">
							<IconBuildingsRegular class="icon" />
							<select
								class="select control-size-3"
								bind:value={selectedClientId}
								required
							>
								<option value="" disabled>{$content.selectClient}</option>
								{#each context.clients ?? [] as client (client.id)}
									<option value={client.id}>{client.name}</option>
								{/each}
							</select>
						</label>
					</div>
				{/if}
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

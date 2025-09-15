<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { context, setContextUser } from "$lib/stores/context.svelte";
	import IconEnvelopeRegular from "phosphor-icons-svelte/IconEnvelopeRegular.svelte";
	import IconUserRegular from "phosphor-icons-svelte/IconUserRegular.svelte";
	import IconUserCheckRegular from "phosphor-icons-svelte/IconUserCheckRegular.svelte";
	import { updateCurrentUser } from "../(api)/users.remote";
	import { UpdateCurrentUser } from "../(api)/users.schema";
	import { userRoles } from "$lib/i18n/contents/users";

	let {
		ref = $bindable(),
	}: {
		ref?: HTMLDialogElement;
	} = $props();

	const content = defineContent({
		en: {
			title: "Account Settings",
			firstName: "First Name",
			lastName: "Last Name",
			email: "Email Address",
			role: "Profile Type",
			save: "Save",
			cancel: "Cancel",
		},
		fr: {
			title: "Paramètres du compte",
			firstName: "Prénom",
			lastName: "Nom",
			email: "Adresse email",
			role: "Type de profil",
			save: "Enregistrer",
			cancel: "Annuler",
		},
	});

	let updating = $state(false);
	let updates: UpdateCurrentUser = $state({
		firstName: context.user!.firstName,
		lastName: context.user!.lastName,
	});

	const hasValidChanges = $derived(
		updates.firstName &&
			updates.lastName &&
			(updates.firstName !== context.user!.firstName ||
				updates.lastName !== context.user!.lastName),
	);

	async function save() {
		updating = true;
		const response = await updateCurrentUser(updates);
		if (response) {
			setContextUser(response);
		}
		updating = false;
		ref?.close();
	}

	function cancel() {
		updates.firstName = context.user!.firstName;
		updates.lastName = context.user!.lastName;
	}
</script>

<dialog bind:this={ref} class="modal">
	<div class="modal-box w-[42rem]">
		<header>
			{$content.title}
		</header>

		<form method="dialog" class="col gap-6 items-stretch">
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
							required
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
							required
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

			<div class="row gap-3 pt-2">
				<button class="btn btn-large grow" disabled={updating} onclick={cancel}>
					{$content.cancel}
				</button>
				<button
					class="btn btn-primary grow"
					disabled={!hasValidChanges || updating}
					onclick={save}
					type="submit"
				>
					{$content.save}
				</button>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button></button>
	</form>
</dialog>

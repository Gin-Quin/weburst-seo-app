<script lang="ts">
	import { userRoles } from "$lib/i18n/contents/users";
	import { context, setContextUser } from "$lib/stores/context.svelte";
	import IconBellRegular from "phosphor-icons-svelte/IconBellRegular.svelte";
	import IconEnvelopeRegular from "phosphor-icons-svelte/IconEnvelopeRegular.svelte";
	import IconGearRegular from "phosphor-icons-svelte/IconGearRegular.svelte";
	import IconUserCheckRegular from "phosphor-icons-svelte/IconUserCheckRegular.svelte";
	import IconUserRegular from "phosphor-icons-svelte/IconUserRegular.svelte";
	import { toast } from "svelte-sonner";
	import { updateCurrentUser } from "../../../api/users.remote";
	import type { UpdateCurrentUser } from "../../../api/users.schema";

	let updating = $state(false);
	let updates: UpdateCurrentUser = $state({
		firstName: context.user?.firstName ?? "",
		lastName: context.user?.lastName ?? "",
		clientInvitationEmailsEnabled: context.user?.clientInvitationEmailsEnabled ?? true,
	});

	const hasValidChanges = $derived(
		updates.firstName.trim().length > 0 &&
			updates.lastName.trim().length > 0 &&
			(updates.firstName !== context.user?.firstName ||
				updates.lastName !== context.user?.lastName ||
				(context.user?.role === "admin" &&
					updates.clientInvitationEmailsEnabled !==
						(context.user.clientInvitationEmailsEnabled ?? true))),
	);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!hasValidChanges || updating) return;

		updating = true;
		try {
			const response = await updateCurrentUser(updates);
			if (response) setContextUser(response);
			toast.success("Vos données ont été mises à jour", { richColors: true });
		} catch {
			toast.error("Impossible de mettre à jour vos données", { richColors: true });
		} finally {
			updating = false;
		}
	}
</script>

<svelte:head>
	<title>Paramètres du compte — WeBurst</title>
</svelte:head>

<div class="PageWrap">
	<section class="AccountPage">
		<header class="PageHeader">
			<div class="HeaderIcon"><IconGearRegular /></div>
			<div>
				<h1>Paramètres du compte</h1>
				<p>Consultez et mettez à jour les informations de votre profil.</p>
			</div>
		</header>

		<form class="AccountForm" onsubmit={save}>
			<section class="SettingsCard" aria-labelledby="profile-title">
				<div class="CardHeading">
					<div class="CardIcon"><IconUserRegular /></div>
					<div>
						<h2 id="profile-title">Informations personnelles</h2>
						<p>Ces informations sont visibles sur votre profil WeBurst.</p>
					</div>
				</div>

				<div class="FieldsGrid">
					<div class="field">
						<div class="field-title">Prénom</div>
						<label class="input w-full">
							<IconUserRegular class="icon" />
							<input
								name="firstName"
								bind:value={updates.firstName}
								placeholder="Prénom"
								required
							/>
						</label>
					</div>

					<div class="field">
						<div class="field-title">Nom</div>
						<label class="input w-full">
							<IconUserRegular class="icon" />
							<input
								name="lastName"
								bind:value={updates.lastName}
								placeholder="Nom"
								required
							/>
						</label>
					</div>

					<div class="field">
						<div class="field-title">Adresse email</div>
						<label class="input w-full">
							<IconEnvelopeRegular class="icon" />
							<input
								name="email"
								type="email"
								value={context.user?.email ?? ""}
								disabled
							/>
						</label>
					</div>

					<div class="field">
						<div class="field-title">Type de profil</div>
						<label class="input w-full">
							<IconUserCheckRegular class="icon" />
							<input
								name="role"
								value={context.user ? $userRoles[context.user.role] : ""}
								disabled
							/>
						</label>
					</div>
				</div>
			</section>

			{#if context.user?.role === "admin"}
				<section class="SettingsCard" aria-labelledby="notifications-title">
					<div class="CardHeading">
						<div class="CardIcon"><IconBellRegular /></div>
						<div>
							<h2 id="notifications-title">Notifications</h2>
							<p>Choisissez les alertes que vous souhaitez recevoir.</p>
						</div>
					</div>

					<label class="NotificationOption">
						<input
							type="checkbox"
							class="checkbox"
							bind:checked={updates.clientInvitationEmailsEnabled}
						/>
						<span>
							<strong>Notifications d’invitation client</strong>
							<small>Recevoir un email lorsqu’un chef de projet invite un client.</small>
						</span>
					</label>
				</section>
			{/if}

			<div class="FormActions">
				<button class="btn btn-primary" type="submit" disabled={!hasValidChanges || updating}>
					{updating ? "Enregistrement…" : "Enregistrer les modifications"}
				</button>
			</div>
		</form>
	</section>
</div>

<style>
	.PageWrap {
		padding: 2rem 2.5rem;
	}

	.AccountPage {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 76rem;
		margin: 0 auto;
		padding: 2rem 2.5rem;
		border: 1px solid var(--color-border);
		border-radius: 1.25rem;
		background: var(--color-base-100);
	}

	.PageHeader,
	.CardHeading {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.PageHeader {
		padding-bottom: 0.5rem;
	}

	.PageHeader h1 {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 700;
	}

	.PageHeader p,
	.CardHeading p {
		margin: 0.25rem 0 0;
		color: var(--color-text-light);
	}

	.HeaderIcon,
	.CardIcon {
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		width: 3rem;
		height: 3rem;
		border-radius: 1rem;
		background: var(--color-primary-light);
		color: var(--color-primary);
	}

	.HeaderIcon :global(svg),
	.CardIcon :global(svg) {
		width: 1.5rem;
		height: 1.5rem;
	}

	.AccountForm {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.SettingsCard {
		padding: 1.5rem;
		border: 1px solid var(--color-border);
		border-radius: 1.25rem;
		background: #fff;
	}

	h2 {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 700;
	}

	.FieldsGrid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.field {
		min-width: 0;
	}

	.NotificationOption {
		display: flex;
		align-items: flex-start;
		gap: 0.9rem;
		margin-top: 1.5rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: 1rem;
		background: var(--color-gray-1);
		cursor: pointer;
	}

	.NotificationOption .checkbox {
		margin-top: 0.15rem;
	}

	.NotificationOption span {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.NotificationOption small {
		color: var(--color-text-light);
	}

	.FormActions {
		display: flex;
		justify-content: flex-end;
		padding-top: 0.5rem;
	}

	@media (max-width: 720px) {
		.PageWrap,
		.AccountPage {
			padding: 1rem;
		}

		.FieldsGrid {
			grid-template-columns: 1fr;
		}

		.FormActions .btn {
			width: 100%;
		}
	}
</style>

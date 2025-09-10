<script lang="ts">
	import IconEnvelopeRegular from "phosphor-icons-svelte/IconEnvelopeRegular.svelte";
	import IconGoogleLogoRegular from "phosphor-icons-svelte/IconGoogleLogoRegular.svelte";
	import IconSignInRegular from "phosphor-icons-svelte/IconSignInRegular.svelte";
	import { sendMagicLink } from "../actions.remote";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import WeBurstLogo from "$lib/assets/images/WeBurst.png";

	const content = defineContent({
		en: {
			welcomeBack: "Welcome back",
			description: "Sign in to access your projects",
			emailPlaceholder: "you@example.com",
			email: "Email",
			userNotFound: "User not found",
			sending: "Sending...",
			sendMagicLink: "Send magic link",
			continueWithGoogle: "Continue with Google",
			or: "OR",
			acceptConditions:
				"By signing in, you agree to our Terms of Service and Privacy Policy.",
			rememberMe: "Remember me",
		},
		fr: {
			welcomeBack: "Bon retour parmi nous",
			description: "Connectez-vous pour accéder à vos projets",
			emailPlaceholder: "prenom@exemple.com",
			email: "Email",
			userNotFound: "Adresse email inconnue",
			sending: "Envoi...",
			sendMagicLink: "Envoyer le lien par email",
			continueWithGoogle: "Se connecter avec Google",
			or: "OU",
			acceptConditions:
				"En vous connectant, vous acceptez nos Conditions d'utilisation et notre Politique de confidentialité.",
			rememberMe: "Se souvenir de moi",
		},
	});

	let email = "";
	let loading = false;
	let message = "";
	let error = "";

	async function onSubmit() {
		loading = true;
		message = "";
		error = "";

		switch (await sendMagicLink({ email })) {
			case "user not found":
				error = "User not found";
				break;
			case "success":
				message = "Magic link sent";
				break;
			default:
				error = "An error occurred. Please try again.";
		}
	}
</script>

<div class="col items-center min-h-screen w-full bg-base-200 gap-10">
	<header class="w-full px-10 py-2">
		<img src={WeBurstLogo} alt="WeBurst Logo" width="280" />
	</header>

	<div class="main card col px-6 py-10 items-center">
		<main class="col items-center gap-5">
			<div class="center w-[4.5rem] h-[4.5rem] rounded-full bg-info-purple">
				<IconSignInRegular class="text-4xl text-purple" />
			</div>

			<div class="col items-center gap-1">
				<h2 class="card-title text-2xl font-bold text-center">
					{$content.welcomeBack}
				</h2>
				<div class="description">
					{$content.description}
				</div>
			</div>

			<form
				on:submit|preventDefault={onSubmit}
				class="col w-full items-stretch gap-3"
			>
				<div class="field">
					<div class="field-title">{$content.email}</div>

					<label class="input w-full">
						<IconEnvelopeRegular class="icon" />
						<input
							class="grow"
							name="email"
							bind:value={email}
							placeholder={$content.emailPlaceholder}
							required
							disabled={loading}
						/>
					</label>
				</div>

				<label class="label">
					<input type="checkbox" checked class="checkbox" />
					{$content.rememberMe}
				</label>

				<button type="submit" class="btn btn-primary mt-2" disabled={loading}>
					{#if loading}
						<span class="loading loading-spinner"></span>
						{$content.sending}
					{:else}
						{$content.sendMagicLink}
					{/if}
				</button>
			</form>

			<!-- <div class="divider">
				{$content.or}
			</div>

			<a href="/auth/login/google" class="btn btn-outline">
				<IconGoogleLogoRegular />
				{$content.continueWithGoogle}
			</a> -->

			<p class="text-center text-sm text-base-content/60 mt-4">
				{$content.acceptConditions}
			</p>
		</main>
	</div>
</div>

<style>
	.main {
		width: 36rem;
		max-width: 95%;
	}
</style>

<script lang="ts">
	import { goto } from "$app/navigation";
	import WeBurstLogo from "$lib/assets/images/WeBurst.png";
	import PinInput from "$lib/components/PinInput.svelte";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import IconEnvelopeRegular from "phosphor-icons-svelte/IconEnvelopeRegular.svelte";
	import IconSignInRegular from "phosphor-icons-svelte/IconSignInRegular.svelte";
	import { sendMagicLink, verifyCode } from "../api/login.remote";

	type MagicLinkResponse = Awaited<ReturnType<typeof sendMagicLink>>;

	const content = defineContent({
		en: {
			welcomeBack: "Welcome back!",
			description: "Sign in to access your projects.",
			emailPlaceholder: "you@example.com",
			email: "Email",
			sending: "Sending...",
			sendMagicLink: "Send magic link",
			continueWithGoogle: "Continue with Google",
			or: "OR",
			acceptConditions:
				"By signing in, you agree to our Terms of Service and Privacy Policy.",
			rememberMe: "Remember me",
			errors: <Record<Exclude<MagicLinkResponse, "success">, string>>{
				"user not found": "Email inexistant",
			},
			enterCode: "Enter the code received by email to sign in.",
			validateCode: "Validate code",
			invalidToken: "Invalid code. Please check your email.",
		},
		fr: {
			welcomeBack: "Bon retour parmi nous !",
			description: "Connectez-vous pour accéder à vos projets.",
			emailPlaceholder: "prenom@exemple.com",
			email: "Email",
			sending: "Envoi...",
			sendMagicLink: "Envoyer le lien par email",
			continueWithGoogle: "Se connecter avec Google",
			or: "OU",
			acceptConditions:
				"En vous connectant, vous acceptez nos Conditions d'utilisation et notre Politique de confidentialité.",
			rememberMe: "Se souvenir de moi",
			errors: <Record<Exclude<MagicLinkResponse, "success">, string>>{
				"user not found": "Adresse email inconnue",
			},
			enterCode: "Entrez le code reçu par email pour vous connecter.",
			validateCode: "Valider le code",
			invalidToken: "Code invalide. Veuillez vérifier votre email.",
		},
	});

	let email = $state("");
	let code = $state("");
	let loading = $state(false);
	let invalidToken = $state(false);
	let magicLinkResponse = $state<MagicLinkResponse | undefined>();
	let stage = $state<"email" | "code">("email");

	async function onSubmit(event: Event) {
		event.preventDefault();
		if (stage == "email") {
			loading = true;
			magicLinkResponse = await sendMagicLink({ email });
			loading = false;
			if (magicLinkResponse == "success") {
				stage = "code";
			}
		} else if (stage == "code") {
			loading = true;
			console.log("verifyCode called");
			const response = await verifyCode({ email, code });
			console.log("verifyCode response:", response);
			if (response) {
				localStorage.setItem("bearer", response);
				goto("/");
			} else {
				invalidToken = true;
				loading = false;
			}
		}
	}
</script>

<div class="col items-center w-full bg-base-200 min-h-[100dvh]">
	<header class="w-full px-10 py-2">
		<img src={WeBurstLogo} alt="WeBurst Logo" width="280" />
	</header>

	<div class="center grow pb-20">
		<div
			class="main card col px-6 py-10 items-center bg-base-100 grow border-0!"
		>
			<main class="col items-center gap-8">
				<div class="center w-[4.5rem] h-[4.5rem] rounded-full bg-info-purple">
					<IconSignInRegular class="text-4xl text-purple" />
				</div>

				<div class="col items-center gap-1">
					<h2 class="card-title text-2xl font-bold text-center">
						{$content.welcomeBack}
					</h2>
					<div class="description">
						{stage == "email" ? $content.description : $content.enterCode}
					</div>
				</div>

				<form onsubmit={onSubmit} class="col w-full items-stretch gap-4">
					{#if stage == "email"}
						<div class="field">
							<div class="field-title">{$content.email}</div>
							<label class="input w-full">
								<IconEnvelopeRegular class="icon" />
								<input
									class="grow"
									name="email"
									type="email"
									bind:value={email}
									placeholder={$content.emailPlaceholder}
									required
									disabled={loading}
								/>
							</label>
						</div>

						{#if magicLinkResponse && magicLinkResponse !== "success"}
							<div class="field-error">
								{$content.errors[magicLinkResponse]}
							</div>
						{/if}

						<label class="label w-full!">
							<input type="checkbox" checked class="checkbox" />
							{$content.rememberMe}
						</label>
					{:else if stage == "code"}
						<PinInput bind:value={code} />

						{#if invalidToken}
							<div class="field-error">
								{$content.invalidToken}
							</div>
						{/if}
					{/if}

					<button type="submit" class="btn btn-primary mt-2" disabled={loading}>
						{#if stage == "email"}
							{#if loading}
								<span class="loading loading-spinner"></span>
								{$content.sending}
							{:else}
								{$content.sendMagicLink}
							{/if}
						{:else if stage == "code"}
							{$content.validateCode}
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
</div>

<style>
	.main {
		width: 36rem;
		max-width: 95%;
	}
</style>

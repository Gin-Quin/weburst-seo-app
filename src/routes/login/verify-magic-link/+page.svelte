<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import Loader from "$lib/components/Loader.svelte";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { onMount } from "svelte";
	import { verifyMagicLink } from "../actions.remote";

	const content = defineContent({
		en: {
			invalidLink: "The link is invalid.",
			pleaseCheckYourEmail: "Please check your email.",
			invalidToken: "Authentication token is invalid.",
		},
		fr: {
			invalidLink: "Lien invalide.",
			pleaseCheckYourEmail: "Veuillez vérifier votre email.",
			invalidToken: "Jeton d'autehtnification invalide.",
		},
	});

	let state = $state<"loading" | "missingParameters" | "invalidToken">(
		"loading",
	);

	onMount(() => {
		verify();
	});

	async function verify() {
		const token = page.url.searchParams.get("token");
		const email = page.url.searchParams.get("email");

		if (!token || !email) {
			state = "missingParameters";
		} else {
			const response = await verifyMagicLink({ email, token });
			if (!response) {
				state = "invalidToken";
			} else {
				localStorage.setItem("bearer", response);
				goto("/");
			}
		}
	}
</script>

<div class="w-full h-full center">
	{#if state == "loading"}
		<Loader />
	{:else if state == "missingParameters"}
		<div class="col center h-screen">
			<div class="text-center">
				<h1 class="text-4xl font-bold mb-4">{$content.invalidLink}</h1>
				<p class="text-gray-600">{$content.pleaseCheckYourEmail}</p>
			</div>
		</div>
	{:else if state == "invalidToken"}
		<div class="col center h-screen">
			<div class="text-center">
				<h1 class="text-4xl font-bold mb-4">{$content.invalidToken}</h1>
				<p class="text-gray-600">{$content.pleaseCheckYourEmail}</p>
			</div>
		</div>
	{/if}
</div>

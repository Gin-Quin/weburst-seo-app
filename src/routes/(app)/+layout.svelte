<script lang="ts">
	import { goto } from "$app/navigation";
	import Loader from "$lib/components/Loader.svelte";
	import { context, setContextUser } from "$lib/stores/context.svelte";
	import { cubicIn } from "svelte/easing";
	import { fade } from "svelte/transition";
	import { getCurrentUser } from "../(api)/login.remote";
	import AppHeader from "./AppHeader.svelte";

	let { children } = $props();

	let loading = $state(true);

	$effect(() => {
		if (context.user) {
			loading = false;
		} else if (!localStorage.getItem("bearer")) {
			goto("/login");
		} else if (!localStorage.getItem("user")) {
			getCurrentUser().then((user) => {
				if (!user) {
					console.log("User from bearer not found");
					// localStorage.removeItem("bearer");
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

{#if loading}
	<Loader class="h-[100dvh] center" />
{:else}
	<div in:fade={{ duration: 400, easing: cubicIn }}>
		<AppHeader />

		<main>
			{@render children()}
		</main>
	</div>
{/if}

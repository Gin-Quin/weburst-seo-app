<script lang="ts">
	import { goto } from "$app/navigation";
	import Loader from "$lib/components/Loader.svelte";
	import { context } from "$lib/stores/context.svelte";
	import { fade } from "svelte/transition";
	import { getCurrentUser } from "../login/actions.remote";
	import { cubicIn, cubicInOut } from "svelte/easing";

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
					localStorage.setItem("user", JSON.stringify(user));
					context.user = user;
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
		{@render children()}
	</div>
{/if}

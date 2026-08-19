<script lang="ts">
	import { goto } from "$app/navigation";
	import Loader from "$lib/components/Loader.svelte";
	import { onMount } from "svelte";

	onMount(() => {
		void goto("/projects", { replaceState: true });
	});
</script>

<Loader class="h-[calc(100dvh-var(--app-header-height))] center" />

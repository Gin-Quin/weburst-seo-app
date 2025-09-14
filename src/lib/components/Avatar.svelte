<script lang="ts">
	import { context } from "$lib/stores/context.svelte";
	import { getInitials } from "$lib/strings/getInitials";

	let { user = context.user } = $props();
</script>

<div class="avatar avatar-placeholder">
	<div
		class="bg-neutral-fade text-neutral-content rounded-full size-14 bold text-md"
	>
		{user ? getInitials(context.user!.firstName, context.user!.lastName) : ""}
	</div>
</div>

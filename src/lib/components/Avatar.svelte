<script lang="ts">
	import type { User } from "$lib/server/db/schema";
	import { context } from "$lib/stores/context.svelte";
	import { getInitials } from "$lib/strings/getInitials";

	let {
		user = context.user,
		size = "normal",
	}: {
		user?: User | null;
		size?: "mini" | "normal";
	} = $props();
</script>

<div class="avatar avatar-placeholder">
	<div
		class="bg-info-purple-content text-info-purple rounded-full bold {size ==
		'mini'
			? 'size-7 text-[0.75rem]'
			: 'size-14 text-md'}"
	>
		{user ? getInitials(user.firstName, user.lastName) : ""}
	</div>
</div>

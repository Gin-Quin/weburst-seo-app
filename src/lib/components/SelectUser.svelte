<script lang="ts">
	import type { Role } from "$lib/server/db/schema";
	import IconUserCheckRegular from "phosphor-icons-svelte/IconUserCheckRegular.svelte";
	import { listUsers } from "../../routes/api/users.remote";

	let {
		class: className = "",
		userId = $bindable(),
		exclude = [],
		roles = ["user", "project_manager"],
	}: {
		class?: string;
		userId: string;
		exclude?: string[];
		roles?: Role[];
	} = $props();
</script>

<label class="select {className}">
	<IconUserCheckRegular class="icon" />
	<select class="select" bind:value={userId}>
		<svelte:boundary>
			{#snippet pending()}{/snippet}

			{#each (await listUsers()).filter(
				(user) => roles.includes(user.role) && !exclude.includes(user.id),
			) as user}
				<option value={user.id}>
					{user.firstName}
					{user.lastName}
					({user.email})
				</option>
			{/each}
		</svelte:boundary>
	</select>
</label>

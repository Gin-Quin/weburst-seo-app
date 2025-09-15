<script lang="ts">
	import IconUserCheckRegular from "phosphor-icons-svelte/IconUserCheckRegular.svelte";
	import { listUsers } from "../../routes/(api)/users.remote";

	let {
		class: className = "",
		userId = $bindable(),
		exclude = [],
	}: {
		class?: string;
		userId: string;
		exclude?: string[];
	} = $props();
</script>

<label class="select {className}">
	<IconUserCheckRegular class="icon" />
	<select class="select" bind:value={userId}>
		<svelte:boundary>
			{#snippet pending()}{/snippet}

			{#each (await listUsers()).filter((user) => !exclude.includes(user.id)) as user}
				<option value={user.id}>
					{user.firstName}
					{user.lastName}
					({user.email})
				</option>
			{/each}
		</svelte:boundary>
	</select>
</label>

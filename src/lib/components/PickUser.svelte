<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import IconUserCheckRegular from "phosphor-icons-svelte/IconUserCheckRegular.svelte";
	import { listUsers } from "../../routes/(api)/users.remote";

	const content = defineContent({
		en: {
			selectUser: "Select User",
		},
		fr: {
			selectUser: "Sélectionner un utilisateur",
		},
	});

	let {
		class: className = "",
		onPickUser,
		exclude = [],
	}: {
		class?: string;
		onPickUser: (userId: string) => void;
		exclude?: string[];
	} = $props();

	let pickedUser = $state<string | null>(null);

	$effect(() => {
		if (pickedUser) {
			onPickUser(pickedUser);
			pickedUser = null;
		}
	});
</script>

{#await listUsers() then userList}
	{@const users = userList.filter((user) => !exclude.includes(user.id))}
	{console.log({ users })}

	{#if users.length > 0}
		<label class="select {className}">
			<IconUserCheckRegular class="icon" />
			<select class="select {className}" bind:value={pickedUser}>
				{#each users as user}
					<option disabled value={null}>
						{$content.selectUser}
					</option>

					<option value={user.id}>
						{user.firstName}
						{user.lastName}
						({user.email})
					</option>
				{/each}
			</select>
		</label>
	{/if}
{/await}

<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { Role } from "$lib/server/db/schema";
	import IconUserCheckRegular from "phosphor-icons-svelte/IconUserCheckRegular.svelte";
	import { listUsers } from "../../routes/api/users.remote";

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
		roles = ["user", "project_manager"],
		placeholder,
		showWhenEmpty = false,
	}: {
		class?: string;
		onPickUser: (userId: string) => void;
		exclude?: string[];
		roles?: Role[];
		placeholder?: string;
		showWhenEmpty?: boolean;
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
	{@const users = userList.filter(
		(user) => roles.includes(user.role) && !exclude.includes(user.id),
	)}

	{#if users.length > 0 || showWhenEmpty}
		<label class="select {className}">
			<IconUserCheckRegular class="icon" />
			<select class="select {className}" bind:value={pickedUser} disabled={users.length === 0}>
				<option disabled value={null}>
					{placeholder ?? $content.selectUser}
				</option>

				{#each users as user}
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

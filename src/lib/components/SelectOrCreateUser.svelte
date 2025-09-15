<script lang="ts">
	import { userRoles } from "$lib/i18n/contents/users";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { User } from "$lib/server/db/schema";
	import { listUsers } from "$lib/server/users";
	import IconUserCheckRegular from "phosphor-icons-svelte/IconUserCheckRegular.svelte";
	import IconUserRegular from "phosphor-icons-svelte/IconUserRegular.svelte";
	import IconEnvelopeRegular from "phosphor-icons-svelte/IconEnvelopeRegular.svelte";
	import type { CreateUser } from "../../routes/(api)/users.schema";
	import { onMount } from "svelte";

	const content = defineContent({
		en: {
			createUser: "+ New user",
			firstName: "Firstname",
			lastName: "Lastname",
			email: "Email",
			role: "Role",
		},
		fr: {
			createUser: "+ Nouvel utilisateur",
			firstName: "Prénom",
			lastName: "Nom",
			email: "Email",
			role: "Rôle",
		},
	});

	let { user }: { user: User } = $props();

	let userList = $state<User[]>([]);
	let userId = $state<string | null>(null);
	let newUser = $state<CreateUser>({
		email: "",
		firstName: "",
		lastName: "",
		role: "user",
	});

	onMount(() => {
		listUsers().then((response) => {
			userList = response;
		});
	});

	$effect(() => {
		if (!userList) return;
	});
</script>

<select class="select" bind:value={userId}>
	<option value={null}>{$content.createUser}</option>
	{#each await listUsers() as user}
		<option value={user.id}>
			{user.firstName}
			{user.lastName}
			({user.email})
		</option>
	{/each}
</select>

{#if userId == null}
	<div class="grid grid-cols-2 gap-3">
		<label class="input">
			<IconEnvelopeRegular class="icon" />
			<input
				type="email"
				placeholder={$content.email}
				bind:value={newUser.email}
			/>
		</label>

		<label class="select">
			<IconUserCheckRegular class="icon" />
			<select class="select" bind:value={newUser.role}>
				{#each Object.entries($userRoles) as [key, value]}
					<option value={key}>{value}</option>
				{/each}
			</select>
		</label>

		<label class="input">
			<IconUserRegular class="icon" />
			<input
				type="text"
				placeholder={$content.firstName}
				bind:value={newUser.firstName}
			/>
		</label>

		<label class="input">
			<IconUserRegular class="icon" />
			<input
				type="text"
				placeholder={$content.lastName}
				bind:value={newUser.lastName}
			/>
		</label>
	</div>
{/if}

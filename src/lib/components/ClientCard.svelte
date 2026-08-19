<script lang="ts">
	import type { ClientInfo } from "../../routes/api/clients.remote";
	import type { ProjectInfo } from "../../routes/api/projects.remote";
	import Avatar from "./Avatar.svelte";
	import type { User } from "$lib/server/db/schema";
	import IconArrowRightRegular from "phosphor-icons-svelte/IconArrowRightRegular.svelte";
	import IconFolderOpenRegular from "phosphor-icons-svelte/IconFolderOpenRegular.svelte";

	let {
		client,
		projects,
	}: {
		client: ClientInfo;
		projects: ProjectInfo[];
	} = $props();
</script>

<a class="ClientCard card-hover" href="/clients/{client.id}">
	<header>
		<span class="ClientMark">{client.name.slice(0, 1).toLocaleUpperCase()}</span>
		<IconArrowRightRegular />
	</header>

	<div class="ClientInfo">
		<h2>{client.name}</h2>
		<p>
			<IconFolderOpenRegular />
			{projects.length} projet{projects.length === 1 ? "" : "s"}
		</p>
	</div>

	<footer>
		<div class="AvatarStack">
			{#each client.projectManagers.slice(0, 4) as manager (manager.id)}
				<Avatar user={manager as unknown as User} size="mini" />
			{/each}
		</div>
		<span>
			{client.projectManagers.length
				? `${client.projectManagers.length} responsable${client.projectManagers.length === 1 ? "" : "s"}`
				: "Aucun responsable"}
		</span>
	</footer>
</a>

<style>
	.ClientCard {
		display: flex;
		min-height: 17rem;
		flex-direction: column;
		padding: 1.5rem;
		border: 1px solid var(--input);
		border-radius: 1.25rem;
		background: var(--color-base-200);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	header > :global(svg) {
		width: 1.5rem;
		height: 1.5rem;
		transition: transform 160ms ease;
	}

	.ClientCard:hover header > :global(svg) {
		transform: translateX(0.25rem);
	}

	.ClientMark {
		display: grid;
		place-items: center;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 1rem;
		background: #e9defd;
		color: #5732a8;
		font-size: 1.25rem;
		font-weight: 700;
	}

	.ClientInfo {
		margin-top: auto;
	}

	h2 {
		font-size: 1.5rem;
		font-weight: 700;
	}

	p {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.25rem;
		color: var(--color-text-light);
	}

	p :global(svg) {
		width: 1.1rem;
		height: 1.1rem;
	}

	footer {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
		color: var(--color-text-light);
		font-size: 0.875rem;
	}

	.AvatarStack {
		display: flex;
	}

	.AvatarStack > :global(*) {
		margin-left: -0.35rem;
		border: 2px solid var(--color-gray-1);
		border-radius: 999px;
	}

	.AvatarStack > :global(*:first-child) {
		margin-left: 0;
	}
</style>

<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import PickUser from "$lib/components/PickUser.svelte";
	import ProjectCard from "$lib/components/ProjectCard.svelte";
	import SelectUser from "$lib/components/SelectUser.svelte";
	import { context } from "$lib/stores/context.svelte";
	import IconArrowLeftRegular from "phosphor-icons-svelte/IconArrowLeftRegular.svelte";
	import IconFloppyDiskRegular from "phosphor-icons-svelte/IconFloppyDiskRegular.svelte";
	import IconPlusRegular from "phosphor-icons-svelte/IconPlusRegular.svelte";
	import IconTrashRegular from "phosphor-icons-svelte/IconTrashRegular.svelte";
	import IconUserRegular from "phosphor-icons-svelte/IconUserRegular.svelte";
	import { toast } from "svelte-sonner";
	import {
		deleteClient,
		listClients,
		updateClient,
	} from "../../../api/clients.remote";

	const client = $derived(
		context.clients?.find(({ id }) => id === page.params.clientId),
	);
	const projects = $derived(
		context.projects?.filter(
			({ clientId }) => clientId === page.params.clientId,
		) ?? [],
	);

	let name = $state("");
	let projectManagerIds = $state<string[]>([]);
	let clientUserIds = $state<string[]>([]);
	let initializedClientId = $state<string>();
	let saving = $state(false);

	$effect(() => {
		if (!client || initializedClientId === client.id) return;
		initializedClientId = client.id;
		name = client.name;
		projectManagerIds = client.projectManagers.map(({ id }) => id);
		clientUserIds = client.clientUsers.map(({ id }) => id);
	});

	const managersChanged = $derived(
		client
			? [...projectManagerIds].sort().join(",") !==
					[...client.projectManagers.map(({ id }) => id)].sort().join(",")
			: false,
	);
	const clientUsersChanged = $derived(
		client
			? [...clientUserIds].sort().join(",") !==
					[...client.clientUsers.map(({ id }) => id)].sort().join(",")
			: false,
	);
	const hasChanges = $derived(
		!!client &&
			!!name.trim() &&
			(name.trim() !== client.name ||
				(context.user?.role === "admin" &&
					(managersChanged || clientUsersChanged))),
	);

	async function save() {
		if (!client || !hasChanges) return;
		saving = true;
		try {
			await updateClient([
				client.id,
				{
					name: name.trim(),
					...(context.user?.role === "admin"
						? { projectManagerIds, clientUserIds }
						: {}),
				},
			]);
			context.clients = await listClients();
			toast.success("Client sauvegardé", { richColors: true });
		} catch {
			toast.error("Impossible de sauvegarder le client", { richColors: true });
		} finally {
			saving = false;
		}
	}

	function confirmArchive() {
		if (!client) return;

		context.openConfirmDialog?.({
			title: "Archiver le client ?",
			description:
				"Le client ne sera plus visible dans la liste des clients.",
			confirmLabel: "Oui, archiver le client",
			color: "error",
			then: archiveClient,
		});
	}

	async function archiveClient() {
		if (!client) return;

		context.isArchivingClient = true;
		try {
			await deleteClient(client.id);
			await goto("/clients");
			context.clients = await listClients();
			toast.success("Client archivé", { richColors: true });
		} catch {
			toast.error("Impossible d’archiver le client", { richColors: true });
		} finally {
			context.isArchivingClient = false;
		}
	}
</script>

{#if client}
	<div class="PageWrap">
		<a href="/clients" class="BackLink control-size-1">
			<IconArrowLeftRegular />
			Mes clients
		</a>

		<section class="ClientPage">
			<header class="PageHeader">
				<div>
					<h1>{client.name}</h1>
					<p>Informations du client</p>
				</div>

				{#if hasChanges}
					<button class="btn btn-primary" disabled={saving} onclick={save}>
						<IconFloppyDiskRegular class="icon" />
						{saving ? "Sauvegarde…" : "Sauvegarder"}
					</button>
				{/if}
			</header>

			<div class="ClientFields">
				<label class="Field">
					<span>Nom du client</span>
					<input class="input input-bordered w-full" bind:value={name} />
				</label>
				<label class="Field">
					<span>Identifiant client</span>
					<input
						class="input input-bordered w-full"
						value={client.id}
						readonly
					/>
				</label>
			</div>

			{#if context.user?.role === "admin"}
				<div class="Managers">
					<span class="text-sm font-semibold">Chefs de projet</span>
					<div class="ManagerList">
						{#each projectManagerIds as managerId, index (managerId)}
							<div class="ManagerRow">
								<SelectUser
									bind:userId={projectManagerIds[index]!}
									class="grow"
									exclude={projectManagerIds.filter((id) => id !== managerId)}
								/>
								<button
									class="IconButton"
									aria-label="Retirer ce chef de projet"
									onclick={() =>
										(projectManagerIds = projectManagerIds.filter(
											(_, itemIndex) => itemIndex !== index,
										))}
								>
									<IconTrashRegular />
								</button>
							</div>
						{/each}
					</div>
					<PickUser
						class="w-full"
						exclude={projectManagerIds}
						onPickUser={(userId) =>
							(projectManagerIds = [...projectManagerIds, userId])}
					/>
				</div>
			{/if}

			<div class="ClientUsers">
				<span class="text-sm font-semibold">Utilisateurs clients</span>
				<div class="ClientUserList">
					{#if context.user?.role === "admin"}
						{#each clientUserIds as clientUserId, index (clientUserId)}
							<div class="ManagerRow">
								<SelectUser
									bind:userId={clientUserIds[index]!}
									class="grow"
									roles={["client"]}
									exclude={clientUserIds.filter((id) => id !== clientUserId)}
								/>
								<button
									class="IconButton"
									aria-label="Retirer cet utilisateur client"
									onclick={() =>
										(clientUserIds = clientUserIds.filter(
											(_, itemIndex) => itemIndex !== index,
										))}
								>
									<IconTrashRegular />
								</button>
							</div>
						{/each}
						<PickUser
							class="w-full"
							roles={["client"]}
							placeholder="Sélectionner un utilisateur client"
							showWhenEmpty
							exclude={clientUserIds}
							onPickUser={(userId) =>
								(clientUserIds = [...clientUserIds, userId])}
						/>
					{:else if client.clientUsers.length === 0}
						<p class="EmptyMembers">Aucun utilisateur client associé.</p>
					{:else}
						{#each client.clientUsers as clientUser (clientUser.id)}
							<div class="ClientUserRow">
								<IconUserRegular />
								<span>
									{clientUser.firstName}
									{clientUser.lastName} ({clientUser.email})
								</span>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</section>

		<section class="ProjectsSection">
			<header>
				<div>
					<h2>Projets du client</h2>
					<p>{projects.length} projet{projects.length === 1 ? "" : "s"}</p>
				</div>
				<button
					class="btn btn-primary"
					onclick={() => context.openProjectDialog?.(undefined, client)}
				>
					<IconPlusRegular class="icon" />
					Nouveau projet
				</button>
			</header>

			<div class="Projects">
				{#if projects.length === 0}
					<p>Aucun projet trouvé pour ce client.</p>
				{:else}
					{#each projects as project (project.id)}
						<ProjectCard {project} />
					{/each}
				{/if}
			</div>
		</section>

		{#if context.user?.role === "admin"}
			<section class="ArchiveSection">
				<h2>Archiver le client</h2>
				<button class="btn btn-error ArchiveButton" onclick={confirmArchive}>
					Archiver le client
				</button>
			</section>
		{/if}
	</div>
{/if}

<style>
	.PageWrap {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 2rem 2.5rem;
	}
	.ClientPage,
	.ProjectsSection,
	.ArchiveSection {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 2rem 2.5rem;
		border: 1px solid var(--color-border);
		border-radius: 1.25rem;
		background: var(--color-base-100);
	}
	.PageHeader,
	.ProjectsSection > header,
	.ArchiveSection,
	.ManagerRow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.PageHeader {
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--color-border);
	}
	.ArchiveSection {
		flex-direction: row;
	}
	.ArchiveButton {
		border-color: var(--color-error);
		background: var(--color-error);
		color: var(--color-error-content);
	}
	.BackLink {
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		gap: 0.4rem;
		height: var(--control-height);
		padding-inline: var(--control-padding-inline);
		border-radius: var(--control-radius);
		color: var(--color-text-light);
		font-size: 0.875rem;
	}
	.BackLink:hover {
		background: var(--color-gray-2);
	}
	.BackLink :global(svg) {
		width: 1rem;
		height: 1rem;
	}
	h1 {
		font-size: 2rem;
		font-weight: 700;
	}
	h2 {
		font-size: 1.25rem;
		font-weight: 700;
	}
	.PageHeader p,
	.ProjectsSection header p {
		color: var(--color-text-light);
	}
	.ClientFields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}
	.Field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.Field > span {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.Managers,
	.ClientUsers {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.ManagerList {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.ClientUserList {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.ClientUserRow {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		height: var(--control-size-3-height);
		padding-inline: var(--control-size-3-padding-inline);
		border: 1px solid var(--color-border);
		border-radius: var(--control-size-3-radius);
		min-width: 0;
	}
	.ClientUserRow :global(svg) {
		width: 1.25rem;
		height: 1.25rem;
		flex: 0 0 auto;
	}
	.ClientUserRow span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.EmptyMembers {
		color: var(--color-text-light);
	}
	.IconButton {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		flex: 0 0 auto;
		border-radius: 0.75rem;
		background: var(--color-gray-1);
		cursor: pointer;
	}
	.IconButton :global(svg) {
		width: 1.25rem;
		height: 1.25rem;
	}
	.ProjectsSection {
		gap: 1rem;
	}
	.Projects {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: 1.25rem;
	}
	@media (max-width: 720px) {
		.PageWrap,
		.ClientPage,
		.ProjectsSection {
			padding: 1rem;
		}
		.PageHeader,
		.ProjectsSection > header,
		.ArchiveSection {
			align-items: flex-start;
			flex-direction: column;
		}
		.ClientFields,
		.Projects {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>

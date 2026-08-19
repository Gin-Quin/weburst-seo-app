<script lang="ts">
	import ClientCard from "$lib/components/ClientCard.svelte";
	import { context } from "$lib/stores/context.svelte";
	import IconPlusRegular from "phosphor-icons-svelte/IconPlusRegular.svelte";
	import { toast } from "svelte-sonner";
	import { createClient, listClients } from "../../api/clients.remote";

	let createClientDialog: HTMLDialogElement;
	let clientName = $state("");
	let creating = $state(false);

	function openCreateClientDialog() {
		clientName = "";
		createClientDialog.showModal();
	}

	async function saveClient() {
		if (!clientName.trim() || creating) return;

		creating = true;
		try {
			await createClient({ name: clientName });
			context.clients = await listClients();
			toast.success("Client créé", { richColors: true });
			createClientDialog.close();
		} catch {
			toast.error("Impossible de créer le client", { richColors: true });
		} finally {
			creating = false;
		}
	}
</script>

<div class="PageWrap">
	<section class="ClientsPage">
		<header class="PageHeader">
			<div>
				<h1>Mes clients</h1>
			</div>

			{#if context.user?.role === "admin"}
				<button
					class="btn btn-primary"
					onclick={openCreateClientDialog}
				>
					<IconPlusRegular class="icon" />
					Nouveau client
				</button>
			{/if}
		</header>

		<div class="Clients">
			{#if !context.clients?.length}
				<p>Aucun client trouvé.</p>
			{:else}
				{#each context.clients as client (client.id)}
					<ClientCard
						{client}
						projects={context.projects?.filter(
							({ clientId }) => clientId === client.id,
						) ?? []}
					/>
				{/each}
			{/if}
		</div>
	</section>
</div>

<dialog bind:this={createClientDialog} class="modal">
	<div class="modal-box w-[32rem]">
		<header>Créer un nouveau client</header>

		<form
			class="col gap-6 items-stretch"
			onsubmit={(event) => {
				event.preventDefault();
				void saveClient();
			}}
		>
			<div class="field">
				<label class="field-title" for="new-client-name">Nom du client</label>
				<label class="input w-full">
					<input
						id="new-client-name"
						class="grow"
						bind:value={clientName}
						placeholder="Nom du client"
						required
					/>
				</label>
			</div>

			<div class="grid grid-cols-2 gap-3 pt-2">
				<button
					class="btn control-size-2"
					disabled={creating}
					type="button"
					onclick={() => createClientDialog.close()}
				>
					Annuler
				</button>
				<button
					type="submit"
					class="btn btn-primary"
					disabled={!clientName.trim() || creating}
				>
					Créer le client
				</button>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button aria-label="Fermer"></button>
	</form>
</dialog>

<style>
	.PageWrap {
		padding: 2rem 2.5rem;
	}
	.ClientsPage {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 2rem 2.5rem;
		border: 1px solid var(--color-border);
		border-radius: 1.25rem;
		background: var(--color-base-100);
	}
	.PageHeader {
		display: flex;
		align-items: center;
		gap: 1rem;
		justify-content: space-between;
		padding-bottom: 1.5rem;
	}
	h1 {
		font-size: 1.75rem;
		font-weight: 700;
	}
	.Clients {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: 1.25rem;
	}
	@media (max-width: 720px) {
		.PageWrap,
		.ClientsPage {
			padding: 1rem;
		}
		.PageHeader {
			align-items: flex-start;
			flex-direction: column;
		}
		.Clients {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>

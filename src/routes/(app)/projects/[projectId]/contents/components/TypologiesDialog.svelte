<script lang="ts">
	import { toast } from "svelte-sonner";
	import { listTypologies, saveTypology } from "../../../../../api/contents/typologies.remote";

	let { projectId, open = $bindable() }: { projectId: string; open?: () => void } = $props();
	let dialog: HTMLDialogElement;
	let id = $state("");
	let name = $state("");
	let instructions = $state("");
	let saving = $state(false);
	const query = $derived(listTypologies({ projectId }));
	open = () => { select(""); void query.refresh(); dialog.showModal(); };
	function select(value: string) {
		id = value;
		const item = query.current?.find((row) => row.id === id);
		name = item?.name ?? "";
		instructions = item?.instructions ?? "";
	}
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (saving) return;
		saving = true;
		try {
			const saved = await saveTypology({ projectId, id: id || undefined, name, instructions });
			id = saved.id;
			toast.success("Typologie enregistrée pour ce client.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
		} finally { saving = false; }
	}
</script>

<dialog bind:this={dialog} class="modal">
	<div class="modal-box w-[42rem] max-w-full">
		<header>Typologies du client</header>
		<p class="text-sm text-light mb-4">Définissez les formats, le ton et la structure à réutiliser dans les articles de ce client.</p>
		{#await query}
			<p>Chargement…</p>
		{:then items}
			<form class="col gap-4" onsubmit={submit}>
				<label class="field">Typologie
					<select class="select w-full" value={id} onchange={(event) => select(event.currentTarget.value)} disabled={saving}>
						<option value="">Nouvelle typologie</option>
						{#each items as item (item.id)}<option value={item.id}>{item.name}</option>{/each}
					</select>
				</label>
				<label class="field">Nom
					<input class="input w-full" bind:value={name} required maxlength="120" placeholder="Guide pratique, fiche produit…" />
				</label>
				<label class="field">Instructions de rédaction
					<textarea class="textarea w-full" rows="8" bind:value={instructions} required maxlength="20000" placeholder="Public cible, ton, structure, longueur et exemples…"></textarea>
				</label>
				<div class="row justify-end gap-2">
					<button type="button" class="btn" onclick={() => dialog.close()} disabled={saving}>Fermer</button>
					<button class="btn btn-primary" disabled={saving || !name.trim() || !instructions.trim()}>Enregistrer</button>
				</div>
			</form>
		{:catch}
			<p class="text-error">Les typologies n’ont pas pu être chargées.</p>
			<button class="btn" onclick={() => query.refresh()}>Réessayer</button>
		{/await}
	</div>
	<form method="dialog" class="modal-backdrop"><button aria-label="Fermer"></button></form>
</dialog>

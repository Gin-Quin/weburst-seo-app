<script lang="ts">
	import { MAX_CHAT_MEMORY_LENGTH } from "$lib/contents/chatMemory";
	import IconFileRegular from "phosphor-icons-svelte/IconFileRegular.svelte";
	import IconTrashRegular from "phosphor-icons-svelte/IconTrashRegular.svelte";
	import { toast } from "svelte-sonner";

	type ExistingFile = {
		id: string;
		name: string;
		mimeType: string;
		size: number;
		createdAt: number;
	};

	type FileSlot = { id: string; file?: File };

	let {
		clientId,
		ref = $bindable(),
		openClientContextDialog = $bindable(),
	}: {
		clientId: string;
		ref?: HTMLDialogElement;
		openClientContextDialog?: () => void;
	} = $props();

	let clientContext = $state("");
	let clientMemory = $state("");
	let existingFiles = $state<ExistingFile[]>([]);
	let deletedFileIds = $state<string[]>([]);
	let fileSlots = $state<FileSlot[]>([newFileSlot()]);
	let loading = $state(false);
	let saving = $state(false);
	let canEdit = $state(false);
	let inputSession = $state(0);

	openClientContextDialog = () => {
		ref?.showModal();
		void loadContext();
	};

	async function loadContext() {
		loading = true;
		deletedFileIds = [];
		fileSlots = [newFileSlot()];
		inputSession += 1;
		try {
			const response = await fetch(`/api/clients/${clientId}/context`);
			const result = await response.json();
			if (!response.ok) throw new Error(result.message || "Le contexte n’a pas pu être chargé.");
			canEdit = result.canEdit;
			clientContext = result.context;
			clientMemory = canEdit ? (result.chatMemory ?? "") : "";
			existingFiles = result.files;
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Le contexte n’a pas pu être chargé.", {
				richColors: true,
			});
			ref?.close();
		} finally {
			loading = false;
		}
	}

	function selectFile(index: number, event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		fileSlots[index]!.file = input.files?.[0];
		if (fileSlots[index]!.file && index === fileSlots.length - 1) {
			fileSlots.push(newFileSlot());
		}
	}

	function removeNewFile(index: number) {
		fileSlots.splice(index, 1);
		ensureEmptyFileSlot();
	}

	function removeExistingFile(file: ExistingFile) {
		deletedFileIds.push(file.id);
		existingFiles = existingFiles.filter(({ id }) => id !== file.id);
	}

	async function downloadExistingFile(file: ExistingFile) {
		try {
			const response = await fetch(`/api/clients/${clientId}/context/files/${file.id}`);
			if (!response.ok) throw new Error(await response.text());
			const url = URL.createObjectURL(await response.blob());
			const link = document.createElement("a");
			link.href = url;
			link.download = file.name;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(url), 0);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Le fichier n’a pas pu être téléchargé.", {
				richColors: true,
			});
		}
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!canEdit || saving) return;
		saving = true;
		try {
			const formData = new FormData();
			formData.set("context", clientContext);
			formData.set("chatMemory", clientMemory);
			formData.set("deletedFileIds", JSON.stringify(deletedFileIds));
			for (const slot of fileSlots) {
				if (slot.file) formData.append("files", slot.file);
			}

			const response = await fetch(`/api/clients/${clientId}/context`, {
				method: "POST",
				body: formData,
			});
			const result = await response.json();
			if (!response.ok) throw new Error(result.message || "Le contexte n’a pas pu être enregistré.");
			clientContext = result.context;
			clientMemory = result.chatMemory;
			existingFiles = result.files;
			deletedFileIds = [];
			fileSlots = [newFileSlot()];
			inputSession += 1;
			toast.success("Contexte du client enregistré", { richColors: true });
			ref?.close();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Le contexte n’a pas pu être enregistré.", {
				richColors: true,
			});
		} finally {
			saving = false;
		}
	}

	function newFileSlot(): FileSlot {
		return { id: crypto.randomUUID() };
	}

	function ensureEmptyFileSlot() {
		if (fileSlots.length === 0 || fileSlots.at(-1)?.file) fileSlots.push(newFileSlot());
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} o`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
	}
</script>

<dialog bind:this={ref} class="modal">
	<div class="modal-box ClientContextModal w-[42rem]">
		<header>
			<h2>Contexte du client</h2>
		</header>

		{#if loading}
			<div class="LoadingContext">Chargement…</div>
		{:else}
			<form class="col gap-6" onsubmit={save}>
				<div class="field">
					<label class="field-title" for="client-context">Informations sur le client</label>
					<textarea
						id="client-context"
						class="textarea w-full min-h-44"
						bind:value={clientContext}
						placeholder="Activité, positionnement, audience, ton éditorial, produits, contraintes…"
						maxlength="50000"
						disabled={!canEdit}
					></textarea>
					<div class="ContextLength">{clientContext.length.toLocaleString("fr-FR")} / 50&nbsp;000</div>
				</div>

				{#if canEdit}
					<div class="field">
						<label class="field-title" for="client-memory">Mémoire du client</label>
						<p class="MemoryHint">
							Informations durables mémorisées par le chat et partagées entre tous les contenus de ce client.
						</p>
						<textarea
							id="client-memory"
							class="textarea w-full min-h-36"
							bind:value={clientMemory}
							placeholder="Ton de marque, audience, terminologie, positionnement…"
							maxlength={MAX_CHAT_MEMORY_LENGTH}
						></textarea>
						<div class="ContextLength">
							{clientMemory.length.toLocaleString("fr-FR")} / {MAX_CHAT_MEMORY_LENGTH.toLocaleString("fr-FR")}
						</div>
					</div>
				{/if}

				<div class="field">
					<div class="field-title">Documents</div>
					<p class="FileHint">Formats acceptés : .txt, .pdf et .md · 10 Mo maximum par fichier</p>

					{#if existingFiles.length > 0}
						<div class="ExistingFiles">
							{#each existingFiles as file (file.id)}
								<div class="FileRow">
									<IconFileRegular class="icon text-accent" />
									<button
										type="button"
										class="FileName"
										title="Télécharger ce fichier"
										onclick={() => downloadExistingFile(file)}
									>{file.name}</button>
									<span class="FileSize">{formatSize(file.size)}</span>
									{#if canEdit}
										<button
											type="button"
											class="btn control-size-1 FileRemove"
											title="Supprimer ce fichier"
											onclick={() => removeExistingFile(file)}
										>
											<IconTrashRegular class="icon" />
										</button>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					{#if canEdit}
						<div class="NewFiles">
							{#key inputSession}
								{#each fileSlots as slot, index (slot.id)}
									<div class="FileInputRow">
										<input
											type="file"
											class="file-input w-full"
											accept=".txt,.pdf,.md,text/plain,text/markdown,application/pdf"
											onchange={(event) => selectFile(index, event)}
										/>
										{#if slot.file}
											<button
												type="button"
												class="btn control-size-1 FileRemove"
												title="Retirer ce fichier"
												onclick={() => removeNewFile(index)}
											>
												<IconTrashRegular class="icon" />
											</button>
										{/if}
									</div>
								{/each}
							{/key}
						</div>
					{/if}
				</div>

				<footer class="grid grid-cols-2 gap-3 pt-1">
					<button class="btn control-size-2" type="button" onclick={() => ref?.close()}>
						{canEdit ? "Annuler" : "Fermer"}
					</button>
					{#if canEdit}
						<button class="btn btn-primary control-size-2" type="submit" disabled={saving}>
							{saving ? "Enregistrement…" : "Enregistrer"}
						</button>
					{/if}
				</footer>
			</form>
		{/if}
	</div>

	<form method="dialog" class="modal-backdrop"><button>Fermer</button></form>
</dialog>

<style>
	.ClientContextModal { padding: 2rem; max-height: min(52rem, calc(100dvh - 2rem)); overflow-y: auto; }
	.ClientContextModal > header { padding-bottom: 1.5rem; }
	h2 { font-size: 2rem; line-height: 1.15; }
	.FileHint, .MemoryHint, .ContextLength, .FileSize { color: var(--color-text-light); }
	.LoadingContext { min-height: 14rem; display: grid; place-items: center; color: var(--color-text-light); }
	.textarea { border: 1px solid var(--input); border-radius: var(--control-size-3-radius); padding: 1rem 1.25rem; }
	.ContextLength { margin-top: 0.35rem; text-align: right; font-size: 0.8rem; }
	.MemoryHint { margin: 0.2rem 0 0.5rem; font-size: 0.9rem; }
	.FileHint { margin: 0.2rem 0 0.75rem; font-size: 0.9rem; }
	.ExistingFiles, .NewFiles { display: grid; gap: 0.5rem; width: 100%; }
	.ExistingFiles { margin-bottom: 0.75rem; }
	.FileRow, .FileInputRow { display: flex; align-items: center; gap: 0.65rem; min-width: 0; width: 100%; }
	.FileRow { min-height: 3rem; padding: 0.5rem 0.65rem; border: 1px solid var(--color-border); border-radius: var(--control-size-2-radius); }
	.FileName { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }
	.FileName:hover { text-decoration: underline; }
	.FileSize { white-space: nowrap; font-size: 0.85rem; }
	.FileRemove { flex: 0 0 auto; color: var(--color-error); }
	.file-input { width: 0 !important; min-width: 0; max-width: none; flex: 1 1 0; }
	@media (max-width: 640px) {
		.ClientContextModal { padding: 1.25rem; }
		footer { grid-template-columns: 1fr; }
	}
</style>

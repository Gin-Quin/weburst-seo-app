<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import IconDownloadSimpleRegular from "phosphor-icons-svelte/IconDownloadSimpleRegular.svelte";
	import IconFileRegular from "phosphor-icons-svelte/IconFileRegular.svelte";
	import IconTrashRegular from "phosphor-icons-svelte/IconTrashRegular.svelte";

	const content = defineContent({
		en: {
			dragAndDrop: "Drag and drop your file here",
			browse: "Browse files",
			or: "or",
			file: "File:",
			size: "Size",
			type: "Type",
			clear: "Clear",
			accept: (types: Array<string> = []) =>
				`Accepted file types: ${types.length ? types.join(", ") : "all files"}`,
			invalidFileType: "Invalid file type. Please select a valid file.",
		},
		fr: {
			dragAndDrop: "Glisser et déposer votre fichier ici",
			browse: "Parcourir les fichiers",
			or: "ou",
			file: "Fichier :",
			size: "Taille",
			type: "Type",
			clear: "Effacer",
			accept: (types: Array<string> = []) =>
				`Type de fichier accepté : ${types.length ? types.join(", ") : "tous les fichiers"}`,
			invalidFileType:
				"Type de fichier invalide. Veuillez sélectionner un fichier valide.",
		},
	});

	let { accept, file = $bindable() }: { accept?: Array<string>; file?: File } =
		$props();

	let dragOver = $state(false);
	let errorMessage = $state("");

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		if (event.dataTransfer?.files?.length) {
			const droppedFile = event.dataTransfer.files[0];
			if (!droppedFile) return;

			// Check if file type is accepted
			if (accept && accept.length > 0) {
				const fileExtension = droppedFile.name.split(".").pop()?.toLowerCase();
				if (!fileExtension || !accept.includes(fileExtension)) {
					// File type not accepted, show error
					errorMessage = $content.invalidFileType;
					return;
				}
			}

			file = droppedFile;
			errorMessage = "";
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files?.length) {
			file = input.files[0];
			errorMessage = "";
		}
	}

	function clearFile() {
		file = undefined;
		errorMessage = "";
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes}B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
	}
</script>

<div class="FileInput col justify-stretch">
	<main class="col justify-stretch w-full">
		{#if !file}
			<div
				class="dropzone text-lg! font-bold description {dragOver ? 'over' : ''}"
				ondragover={(e) => {
					e.preventDefault();
					dragOver = true;
				}}
				ondragleave={() => (dragOver = false)}
				ondrop={handleDrop}
			>
				<div class="center p-5">
					<IconDownloadSimpleRegular class="text-[4rem] text-accent" />
				</div>
				<div>{$content.dragAndDrop}</div>
				<div>{$content.or}</div>
				<label for="file-input" class="browse pb-5">{$content.browse}</label>
				<input
					id="file-input"
					type="file"
					accept={accept?.map((type) => `.${type}`).join(",")}
					onchange={handleFileSelect}
					hidden
				/>
			</div>
		{:else}
			<div class="py-6 px-8 row items-center justify-between">
				<div class="col gap-0">
					<strong>{$content.file}</strong>
					<div class="row py-2 items-center justify-between">
						<div class="row items-center gap-2">
							<span class="file-icon">
								<IconFileRegular class="text-lg text-accent" />
							</span>
							<span class="file-name">{file.name}</span>
							<span class="file-size">{formatSize(file.size)}</span>
						</div>
					</div>
				</div>

				<button
					type="button"
					class="delete-btn"
					onclick={clearFile}
					title={$content.clear}
				>
					<IconTrashRegular class="text-xl" />
				</button>
			</div>
		{/if}
	</main>

	{#if !file}
		<div class="hint">{$content.accept(accept)}</div>
	{/if}

	{#if errorMessage}
		<div class="text-error bold">{errorMessage}</div>
	{/if}
</div>

<style>
	.FileInput {
		gap: 1rem;

		& > main {
			border: 2px dashed #ccc;
			border-radius: 6px;
			/*padding-block: 1.5rem;
			padding-inline: 2rem;*/
			transition: border-color 0.2s ease;
			transition: border-color 0.2s ease;
			gap: 1rem;
		}
	}

	/* Dropzone */
	.dropzone {
		text-align: center;
		padding-inline: 3rem;
		padding-block-start: 1.5rem;
		padding-block-end: 2.75rem;
	}
	.dropzone.over {
		border-color: #00cc66;
		background: #f9f9f9;
	}
	.browse {
		color: #7b5cff;
		cursor: pointer;
		text-decoration: underline;
	}

	.file-icon {
		font-size: 1.5rem;
	}
	.file-name {
		flex: 1;
	}
	.file-size {
		font-size: 0.9rem;
		color: #555;
	}

	/* Delete button */
	.delete-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 4px;
		color: #666;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.delete-btn:hover {
		background: #f3f4f6;
		color: #dc2626;
	}

	.hint {
		color: #666;
		font-weight: bold;
	}
</style>

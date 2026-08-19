<script lang="ts">
	import FileInput from "$lib/components/FileInput.svelte";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { parseKeywordsCsv } from "$lib/keywords/parseKeywordsCsv";
	import { parseKeywordsXlsx } from "$lib/keywords/parseKeywordsXlsx";
	import type { KeywordTuple } from "$lib/server/clickhouse/services/keywords";
	import { context, type Context } from "$lib/stores/context.svelte";
	import { toast } from "svelte-sonner";
	import { addKeywords } from "../../../api/keywords/index.remote";
	import type { ProjectContext } from "$lib/stores/projectContext.svelte";
	import { startNewAnalysis } from "./startNewAnalysis";

	const content = defineContent({
		en: {
			title: "Add Keywords",
			cancel: "Cancel",
			submit: "Submit",
			instructions: [
				"The file must contain two columns: the keyword and the volume associated.",
				"The file can include or not a header.",
			],
			keywordsAddedSuccessfully: "Keywords added successfully.",
			errorAddingKeywords: "An error occurred while adding keywords.",
			startAnalysis: "Start Analysis?",
			startAnalysisDescription:
				"Keywords added successfully. Do you want to start a analysis using the new keywords?",
		},
		fr: {
			title: "Ajouter des mots-clés",
			cancel: "Annuler",
			submit: "Ajouter",
			instructions: [
				"Le fichier doit contenir deux colonnes : le mot-clé et le volume associé.",
				"Le fichier peut inclure ou non un header.",
			],
			keywordsAddedSuccessfully: "Mots-clés ajoutés avec succès.",
			errorAddingKeywords:
				"Une erreur est survenue lors de l'ajout des mots-clés.",
			startAnalysis: "Démarrer une analyse ?",
			startAnalysisDescription:
				"Les mots-clés ont été ajoutés avec succès. Voulez-vous démarrer une analyse en utilisant les nouveaux mots-clés ?",
		},
	});

	let {
		openAddKeywordsDialog = $bindable(),
	}: {
		openAddKeywordsDialog: ProjectContext["openAddKeywordsDialog"];
	} = $props();

	let ref: HTMLDialogElement;

	let file = $state<File | undefined>();
	let keywords = $state<Array<KeywordTuple> | undefined | Error>();
	let loading = $state<boolean>(false);
	let afterAnalysis = $state<() => void | undefined>();

	$effect(() => {
		if (file) {
			parseFile(file);
		} else {
			keywords = undefined;
		}
	});

	openAddKeywordsDialog = (input = {}) => {
		file = undefined;
		afterAnalysis = input.afterAnalysis;
		ref?.showModal();
	};

	async function parseFile(file: File) {
		if (file.type == "text/csv") {
			keywords = await parseKeywordsCsv(file);
		} else if (
			file.type ==
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		) {
			keywords = await parseKeywordsXlsx(file);
		}
	}

	async function submit() {
		if (!Array.isArray(keywords)) return;

		try {
			await addKeywords({
				projectId: context.project!.id,
				keywords,
			});
			toast.success($content.keywordsAddedSuccessfully, {
				richColors: true,
			});
			context.openConfirmDialog?.({
				title: $content.startAnalysis,
				description: $content.startAnalysisDescription,
				color: "primary",
				then: () => {
					startNewAnalysis({
						projectId: context.project!.id,
						then: afterAnalysis,
					});
				},
			});
		} catch (error) {
			console.error(error);
			toast.error($content.errorAddingKeywords, {
				richColors: true,
			});
		}
	}
</script>

<dialog bind:this={ref} class="modal">
	<div class="modal-box w-[42rem]">
		<header>
			{$content.title}
		</header>

		<form method="dialog" class="col gap-6 items-stretch">
			<ul class="list-disc pl-4">
				{#each $content.instructions as instruction}
					<li>{instruction}</li>
				{/each}
			</ul>

			<FileInput bind:file accept={["csv", "xlsx"]} />

			{#if keywords instanceof Error}
				<div class="py-1 text-error bold">{String(keywords)}</div>
			{/if}

			<div class="grid grid-cols-2 gap-3 pt-2">
				<button
					class="btn control-size-2"
					type="button"
					onclick={() => ref?.close()}
				>
					{$content.cancel}
				</button>
				<button
					class="btn btn-primary"
					type="submit"
					disabled={!Array.isArray(keywords) || loading}
					onclick={submit}
				>
					{$content.submit}
				</button>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button></button>
	</form>
</dialog>

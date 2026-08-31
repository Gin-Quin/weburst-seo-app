<script lang="ts">
	import FileInput from "$lib/components/FileInput.svelte";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { parseKeywordsCsv } from "$lib/keywords/parseKeywordsCsv";
	import { parseKeywordsXlsx } from "$lib/keywords/parseKeywordsXlsx";
	import type { KeywordTuple } from "$lib/server/clickhouse/services/keywords";
	import { context, type Context } from "$lib/stores/context.svelte";
	import { toast } from "svelte-sonner";
	import {
		addKeywords,
		hasKeywords as getHasKeywords,
	} from "../../../api/keywords/index.remote";
	import type { ProjectContext } from "$lib/stores/projectContext.svelte";
	import { startNewAnalysis } from "./startNewAnalysis";

	const content = defineContent({
		en: {
			title: "Add Keywords",
			cancel: "Cancel",
			submit: "Submit",
			replace: "Replace existing keywords with the new ones",
			append: "Complete existing keywords with the new ones",
			instructions: [
				"The file must contain the keyword and its volume. A third clusters column can group keywords together.",
				"The file can include or not a header.",
			],
			keywordsAddedSuccessfully: "Keywords added successfully.",
			errorAddingKeywords: "An error occurred while adding keywords.",
			errorLoadingKeywords: "The existing keywords could not be loaded.",
			startAnalysis: "Start Analysis?",
			startAnalysisDescription:
				"Keywords added successfully. Do you want to start a analysis using the new keywords?",
		},
		fr: {
			title: "Ajouter des mots-clés",
			cancel: "Annuler",
			submit: "Ajouter",
			replace: "Remplacer les anciens mots-clés par les nouveaux",
			append: "Compléter les anciens mots-clés par les nouveaux",
			instructions: [
				"Le fichier doit contenir le mot-clé et son volume. Une troisième colonne clusters peut regrouper les mots-clés.",
				"Le fichier peut inclure ou non un header.",
			],
			keywordsAddedSuccessfully: "Mots-clés ajoutés avec succès.",
			errorAddingKeywords:
				"Une erreur est survenue lors de l'ajout des mots-clés.",
			errorLoadingKeywords:
				"Les mots-clés existants n’ont pas pu être chargés.",
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
	let hasExistingKeywords = $state<boolean | undefined>();
	let afterAnalysis = $state<() => void | undefined>();
	let keywordStatusRequestId = 0;

	$effect(() => {
		if (file) {
			parseFile(file);
		} else {
			keywords = undefined;
		}
	});

	openAddKeywordsDialog = (input = {}) => {
		file = undefined;
		hasExistingKeywords = undefined;
		afterAnalysis = input.afterAnalysis;
		ref?.showModal();
		void loadKeywordStatus(++keywordStatusRequestId);
	};

	async function loadKeywordStatus(requestId: number) {
		const projectId = context.project?.id;
		if (!projectId) return;

		try {
			const keywordStatusQuery = getHasKeywords({ projectId });
			await keywordStatusQuery.refresh();
			const result = await keywordStatusQuery;
			if (requestId === keywordStatusRequestId) {
				hasExistingKeywords = result;
			}
		} catch (error) {
			console.error(error);
			if (requestId === keywordStatusRequestId) {
				toast.error($content.errorLoadingKeywords, { richColors: true });
			}
		}
	}

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

	async function submit(mode: "replace" | "append") {
		if (!Array.isArray(keywords) || hasExistingKeywords === undefined) return;

		loading = true;
		try {
			await addKeywords({
				projectId: context.project!.id,
				keywords,
				mode,
			});
			toast.success($content.keywordsAddedSuccessfully, {
				richColors: true,
			});
			ref?.close();
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
		} finally {
			loading = false;
		}
	}
</script>

<dialog bind:this={ref} class="modal">
	<div class="modal-box w-[42rem]">
		<header>
			{$content.title}
		</header>

		<form
			method="dialog"
			class="col gap-6 items-stretch"
			onsubmit={(event) => event.preventDefault()}
		>
			<ul class="list-disc pl-4">
				{#each $content.instructions as instruction}
					<li>{instruction}</li>
				{/each}
			</ul>

			<FileInput bind:file accept={["csv", "xlsx"]} />

			{#if keywords instanceof Error}
				<div class="py-1 text-error bold">{String(keywords)}</div>
			{/if}

			<div class="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
				{#if hasExistingKeywords}
					<button
						class="btn btn-primary h-auto! min-h-12 py-2! text-sm whitespace-normal text-balance"
						type="button"
						disabled={!Array.isArray(keywords) || loading}
						onclick={() => submit("replace")}
					>
						{$content.replace}
					</button>
					<button
						class="btn btn-primary h-auto! min-h-12 py-2! text-sm whitespace-normal text-balance"
						type="button"
						disabled={!Array.isArray(keywords) || loading}
						onclick={() => submit("append")}
					>
						{$content.append}
					</button>
					<button
						class="btn control-size-2 sm:col-span-2"
						disabled={loading}
						type="button"
						onclick={() => ref?.close()}
					>
						{$content.cancel}
					</button>
				{:else}
					<button
						class="btn control-size-2"
						disabled={loading}
						type="button"
						onclick={() => ref?.close()}
					>
						{$content.cancel}
					</button>
					<button
						class="btn btn-primary"
						type="button"
						disabled={
							!Array.isArray(keywords) ||
							loading ||
							hasExistingKeywords === undefined
						}
						onclick={() => submit("replace")}
					>
						{$content.submit}
					</button>
				{/if}
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button></button>
	</form>
</dialog>

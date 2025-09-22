<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { KeywordAnalysisStatus } from "$lib/server/clickhouse/services/keywords";
	import { context } from "$lib/stores/context.svelte";
	import { projectContext } from "$lib/stores/projectContext.svelte";
	import { SECOND } from "$lib/timeUnits";
	import IconArrowsClockwiseRegular from "phosphor-icons-svelte/IconArrowsClockwiseRegular.svelte";
	import IconDownloadSimpleRegular from "phosphor-icons-svelte/IconDownloadSimpleRegular.svelte";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import {
		getAnalysisResultsWithTrend,
		getAnalysisStatus,
		startKeywordAnalysis,
	} from "../../../../api/keywords/index.remote";
	import ProjectSettingsDropdown from "../ProjectSettingsDropdown.svelte";
	import KeywordAnalysisProgress from "./KeywordAnalysisProgress.svelte";
	import SectionCompetitiveMapping from "./SectionCompetitiveMapping.svelte";
	import SectionLeaders from "./SectionLeaders.svelte";
	import SectionPotential from "./SectionPotential.svelte";
	import SectionShareOfVoice from "./SectionShareOfVoice.svelte";
	import Loader from "$lib/components/Loader.svelte";
	import { SvelteSet } from "svelte/reactivity";

	const content = defineContent({
		en: {
			addKeywords: "Add Keywords",
			startAnalysis: "Start new Analysis",
			confirmStartAnalysis: "Do you want to start a new analysis?",
			confirmStartAnalysisDescription:
				"This will start a new analysis for the project using the most recent keyword set. The analysis will take a few minutes to complete.",
			analysisStartedSuccess:
				"Analysis started. Wait a few minutes for the results to be ready.",
			analysisStartedError: "An error occurred while starting the analysis.",
			noAnalysisResults:
				"No data available. Add keywords and start an analysis.",
		},
		fr: {
			addKeywords: "Ajouter des mots-clés",
			startAnalysis: "Lancer une analyse",
			confirmStartAnalysis: "Voulez-vous lancer une nouvelle analyse&nbsp;?",
			confirmStartAnalysisDescription:
				"Cela lancera une nouvelle analyse pour le projet en utilisant l'ensemble de mots-clés le plus récent. L'analyse prendra quelques minutes à se terminer.",
			analysisStartedSuccess:
				"Analyse démarrée. Les résultats seront prêts dans quelques minutes.",
			analysisStartedError:
				"Une erreur est survenue lors du lancement de l'analyse.",
			noAnalysisResults:
				"Aucune donnée disponible. Ajoutez des mots-clés et lancez une analyse.",
		},
	});

	let analysisRunning = $state(false);
	let lastAnalysisStatus = $state<KeywordAnalysisStatus | undefined>();
	let fetchLastAnalysisStatusTimeout: ReturnType<typeof setTimeout>;
	let visibleDomains = new SvelteSet<string>([context.project!.domain]);

	let analysisResultsWithTrendQuery = getAnalysisResultsWithTrend({
		projectId: context.project!.id,
	});

	onMount(() => {
		fetchLastAnalysisStatus();

		return () => {
			clearTimeout(fetchLastAnalysisStatusTimeout);
		};
	});

	async function fetchLastAnalysisStatus() {
		const response = await getAnalysisStatus({
			projectId: context.project!.id,
		});
		if (response !== null) {
			lastAnalysisStatus = response;
		}
		const wasRunning = analysisRunning;
		analysisRunning =
			!!response &&
			response.completedTasks + response.failedTasks < response.totalTasks;
		const intervalDuration = (analysisRunning ? 1 : 10) * SECOND;
		fetchLastAnalysisStatusTimeout = setTimeout(
			fetchLastAnalysisStatus,
			intervalDuration,
		);

		if (wasRunning && !analysisRunning) {
			analysisResultsWithTrendQuery.refresh();
		}
	}

	function startAnalysis() {
		context.openConfirmDialog?.({
			title: $content.confirmStartAnalysis,
			description: $content.confirmStartAnalysisDescription,
			color: "primary",
			then: () => {
				startKeywordAnalysis({
					projectId: context.project!.id,
				})
					.then(() => {
						toast.success($content.analysisStartedSuccess, {
							richColors: true,
						});
						clearTimeout(fetchLastAnalysisStatusTimeout);
						fetchLastAnalysisStatus();
					})
					.catch((error) => {
						console.error(error);
						toast.error($content.analysisStartedError, {
							richColors: true,
						});
					});
			},
		});
	}
</script>

<div class="Page px-10 py-8 w-full gap-5 grid">
	<header class="row justify-between gap-3">
		<div class="row justify-between gap-3">
			<button class="btn" onclick={() => projectContext.openKeywordsDialog?.()}>
				<IconDownloadSimpleRegular class="icon text-accent" />
				{$content.addKeywords}
			</button>
			<button class="btn" onclick={startAnalysis}>
				<IconArrowsClockwiseRegular class="icon text-accent" />
				{$content.startAnalysis}
			</button>
			{#if lastAnalysisStatus}
				<KeywordAnalysisProgress analysis={lastAnalysisStatus} />
			{/if}
		</div>

		<div class="row justify-between gap-3">
			<ProjectSettingsDropdown />
		</div>
	</header>

	{#await analysisResultsWithTrendQuery}
		<Loader />
	{:then analysisResultsWithTrend}
		{#if analysisResultsWithTrend == null}
			<div class="center text-xl text-light bold">
				{$content.noAnalysisResults}
			</div>
		{:else}
			{@const client = analysisResultsWithTrend.data.find(
				(item) => item.domain === context.project!.domain,
			) ?? {
				domain: context.project!.domain,
				topThreeKeywordCount: 0,
				topTenKeywordCount: 0,
				volume: 0,
				trend: 0,
			}}

			<div class="grid grid-cols-[1.6fr_1fr] gap-5">
				<SectionShareOfVoice
					{analysisResultsWithTrend}
					{visibleDomains}
					{client}
				/>
				<SectionLeaders {analysisResultsWithTrend} {visibleDomains} {client} />
			</div>

			<div class="grid grid-cols-[1fr_1.8fr] gap-5">
				<SectionPotential {analysisResultsWithTrend} {client} />
				<SectionCompetitiveMapping />
			</div>
		{/if}
	{:catch error}
		<div class="text-error bold">
			{String(error)}
		</div>
	{/await}
</div>

<style>
	.Page {
		height: calc(100dvh - var(--app-header-height));
		min-height: 800px;
		grid-template-columns: 1fr;
		grid-template-rows: 2.5rem 1fr 1fr;
	}
</style>

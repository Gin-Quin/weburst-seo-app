<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { canManageKeywords } from "$lib/keywords/access";
	import { canViewProjectContents } from "$lib/contents/access";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { loadWithDiagnostics } from "$lib/loading/loadWithDiagnostics";
	import { reportLoadError } from "$lib/loading/reportLoadError";
	import type { KeywordAnalysisStatus } from "$lib/server/clickhouse/services/keywords";
	import { context } from "$lib/stores/context.svelte";
	import { projectContext } from "$lib/stores/projectContext.svelte";
	import { SECOND } from "$lib/timeUnits";
	import IconArrowsClockwiseRegular from "phosphor-icons-svelte/IconArrowsClockwiseRegular.svelte";
	import IconDownloadSimpleRegular from "phosphor-icons-svelte/IconDownloadSimpleRegular.svelte";
	import IconExportRegular from "phosphor-icons-svelte/IconExportRegular.svelte";
	import { onMount } from "svelte";
	import { fade } from "svelte/transition";
	import {
		getAllAggregatedAnalysisResults,
		getAnalysisResultsWithTrend,
		getAnalysisStatus,
		getKeywordClusters,
	} from "../../../api/keywords/index.remote";
	import AddKeywordsDialog from "./AddKeywordsDialog.svelte";
	import { exportDataToCsv } from "./exportDataToCsv";
	import KeywordAnalysisProgress from "./share-of-voice/KeywordAnalysisProgress.svelte";
	import { startNewAnalysis } from "./startNewAnalysis";

	const content = defineContent({
		en: {
			addKeywords: "Add Keywords",
			startAnalysis: "Start new Analysis",
			confirmStartAnalysis: "Do you want to start a new analysis?",
			confirmStartAnalysisDescription:
				"This will start a new analysis for the project using the most recent keyword set. The analysis will take a few minutes to complete.",
			export: "Export as CSV",
			loadFailed: "Unable to load project data.",
			retry: "Retry",
		},
		fr: {
			addKeywords: "Ajouter des mots-clés",
			startAnalysis: "Lancer une analyse",
			confirmStartAnalysis: "Voulez-vous lancer une nouvelle analyse&nbsp;?",
			confirmStartAnalysisDescription:
				"Cela lancera une nouvelle analyse pour le projet en utilisant l'ensemble de mots-clés le plus récent. L'analyse prendra quelques minutes à se terminer.",
			export: "Exporter en CSV",
			loadFailed: "Impossible de charger les données du projet.",
			retry: "Réessayer",
		},
	});

	let { children } = $props();

	let analysisRunning = $state(false);
	let projectLoadFailed = $state(false);
	let disposed = false;
	let lastAnalysisStatus = $state<KeywordAnalysisStatus | undefined>();
	let fetchLastAnalysisStatusTimeout: ReturnType<typeof setTimeout>;
	const canManageProjectKeywords = $derived(canManageKeywords(context.user?.role));
	const isContentsPage = $derived(page.url.pathname.includes("/contents"));
	const isShareOfVoicePage = $derived(
		page.url.pathname.endsWith("/share-of-voice") ||
			page.url.pathname.endsWith("/keyword-similarities"),
	);
	const canViewShareOfVoice = $derived(
		context.project?.shareOfVoiceEnabled ?? true,
	);
	const canViewContents = $derived(
		(context.project?.contentWritingEnabled ?? true) &&
			canViewProjectContents(context.user?.role, context.project?.type),
	);

	$effect(() => {
		if (context.project && isContentsPage && !canViewContents) {
			void goto(
				canViewShareOfVoice
					? `/projects/${context.project.id}/share-of-voice`
					: "/projects",
				{ replaceState: true },
			);
		} else if (context.project && isShareOfVoicePage && !canViewShareOfVoice) {
			void goto(
				canViewContents ? `/projects/${context.project.id}/contents` : "/projects",
				{ replaceState: true },
			);
		}
	});

	$inspect({ lastAnalysisStatus });

	$effect(() => {
		if (context.project) {
			let active = true;
			projectLoadFailed = false;
			const details = {
				projectId: context.project.id,
				userId: context.user?.id,
				pathname: window.location.pathname,
			};
			projectContext.analysisResultsWithTrendQuery =
				getAnalysisResultsWithTrend({
					projectId: context.project.id,
				});
			projectContext.keywordClustersQuery = getKeywordClusters({
				projectId: context.project.id,
			});
			const analysisQuery = projectContext.analysisResultsWithTrendQuery;
			const clustersQuery = projectContext.keywordClustersQuery;
			const onError = (failure: Parameters<typeof reportLoadError>[0]) => {
				if (active) reportLoadError(failure, details);
			};
			void Promise.all([
				loadWithDiagnostics("getAnalysisResultsWithTrend", () => analysisQuery, onError),
				loadWithDiagnostics("getKeywordClusters", () => clustersQuery, onError),
			]).catch(() => {
				if (active) projectLoadFailed = true;
			});
			return () => {
				active = false;
			};
		}
	});

	onMount(() => {
		disposed = false;
		fetchLastAnalysisStatus();

		return () => {
			disposed = true;
			clearTimeout(fetchLastAnalysisStatusTimeout);
		};
	});

	async function fetchLastAnalysisStatus() {
		if (disposed) return;
		if (!context.project) {
			fetchLastAnalysisStatusTimeout = setTimeout(fetchLastAnalysisStatus, 500);
			return;
		}

		const projectId = context.project.id;
		const details = { projectId, userId: context.user?.id, pathname: window.location.pathname };
		let response;
		try {
			response = await loadWithDiagnostics(
				"getAnalysisStatus",
				() => getAnalysisStatus({ projectId }),
				(failure) => {
					if (!disposed && context.project?.id === projectId) reportLoadError(failure, details);
				},
			);
		} catch {
			// Resume polling after a transient failure without an unhandled rejection.
			if (!disposed) {
				fetchLastAnalysisStatusTimeout = setTimeout(fetchLastAnalysisStatus, 30 * SECOND);
			}
			return;
		}
		if (disposed) return;
		if (context.project?.id !== projectId) {
			fetchLastAnalysisStatusTimeout = setTimeout(fetchLastAnalysisStatus, 0);
			return;
		}
		if (response !== null) {
			lastAnalysisStatus = response;
		}
		const wasRunning = analysisRunning;

		analysisRunning =
			!!response &&
			response.status === "pending";

		const intervalDuration = (analysisRunning ? 1 : 10) * SECOND;
		fetchLastAnalysisStatusTimeout = setTimeout(
			fetchLastAnalysisStatus,
			intervalDuration,
		);

		if (wasRunning && !analysisRunning) {
			setTimeout(() => {
				projectContext.analysisResultsWithTrendQuery?.refresh();
				projectContext.keywordClustersQuery?.refresh();
				getAllAggregatedAnalysisResults({ projectId: context.project!.id }).refresh();
			}, 1000);
		}
	}

	function startAnalysis() {
		if (!canManageProjectKeywords) return;
		context.openConfirmDialog?.({
			title: $content.confirmStartAnalysis,
			description: $content.confirmStartAnalysisDescription,
			color: "primary",
			then: () =>
				startNewAnalysis({
					projectId: context.project!.id,
					then: () => {
						clearTimeout(fetchLastAnalysisStatusTimeout);
						fetchLastAnalysisStatus();
					},
				}),
		});
	}
</script>

{#if context.project && isContentsPage && canViewContents}
	<div class="EmptyPage" in:fade={{ duration: 300 }}>
		{@render children()}
	</div>
{:else if projectLoadFailed}
	<div class="center flex-col gap-4 p-10" role="alert">
		<p>{$content.loadFailed}</p>
		<button class="btn" onclick={() => window.location.reload()}>{$content.retry}</button>
	</div>
{:else if context.project && projectContext.analysisResultsWithTrendQuery && projectContext.keywordClustersQuery}
	{#if canManageProjectKeywords}
		<AddKeywordsDialog
			bind:openAddKeywordsDialog={projectContext.openAddKeywordsDialog}
		/>
	{/if}

	<div in:fade={{ duration: 300 }}>
		<div
			class="Page Page-{page.url.pathname
				.split('/')
				.at(-1)} px-10 py-8 w-full gap-5 grid"
		>
			<header class="ProjectToolbar">
				<div class="ToolbarActions">
					{#if canManageProjectKeywords}
						<button
							class="btn control-size-1"
							onclick={() =>
								projectContext.openAddKeywordsDialog?.({
									afterAnalysis: () => {
										clearTimeout(fetchLastAnalysisStatusTimeout);
										fetchLastAnalysisStatus();
									},
								})}
						>
							<IconDownloadSimpleRegular class="icon text-accent" />
							{$content.addKeywords}
						</button>
						<button class="btn control-size-1" onclick={startAnalysis}>
							<IconArrowsClockwiseRegular class="icon text-accent" />
							{$content.startAnalysis}
						</button>
						{#if page.url.pathname.endsWith("keyword-similarities")}
							<button
								class="btn control-size-1"
								onclick={() => exportDataToCsv(context.project!.id)}
							>
								<IconExportRegular class="icon text-accent" />
								{$content.export}
							</button>
						{/if}
					{/if}

					{#if lastAnalysisStatus}
						<KeywordAnalysisProgress analysis={lastAnalysisStatus} />
					{/if}
				</div>
			</header>

			{@render children()}
		</div>
	</div>
{/if}

<style>
	.Page {
		height: calc(100dvh - var(--app-header-height));
	}

	.EmptyPage {
		min-height: calc(100dvh - var(--app-header-height));
	}

	.Page-share-of-voice {
		min-height: 800px;
		grid-template-columns: 1fr;
		grid-template-rows: 2.5rem 1fr 1fr;
	}

	.ProjectToolbar,
	.ToolbarActions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.ProjectToolbar {
		justify-content: space-between;
		min-width: 0;
	}

	.ToolbarActions {
		flex-wrap: wrap;
		min-width: 0;
	}

	.Page-keyword-similarities {
		grid-template-columns: 1fr;
		grid-template-rows: 2.5rem 1fr /*1fr*/;
		min-height: 600px;
	}

	@media (max-width: 900px) {
		.Page-share-of-voice {
			height: auto;
			grid-template-rows: auto;
		}

		.ProjectToolbar {
			align-items: flex-start;
			flex-wrap: wrap;
		}
	}

	@media (max-width: 720px) {
		.Page {
			padding: 1rem;
		}

		.ToolbarActions {
			width: 100%;
		}
	}
</style>

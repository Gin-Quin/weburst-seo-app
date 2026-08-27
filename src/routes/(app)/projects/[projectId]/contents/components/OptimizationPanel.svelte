<script lang="ts">
	import {
		analyzeOptimizationContent,
		getOptimizationState,
		getStructureMetrics,
		type OptimizationContent,
	} from "$lib/contents/optimization";
	import OptimizationScore from "$lib/components/OptimizationScore.svelte";
	import type { ContentDetail } from "$lib/server/contents";
	import type { SerpmanticsExpression } from "$lib/server/serpmantics";
	import IconSparkleRegular from "phosphor-icons-svelte/IconSparkleRegular.svelte";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import {
		refreshOptimization,
		retryOptimizationGuide,
	} from "../../../../../api/contents/contents.remote";

	let {
		content,
		draft,
		onContentUpdated,
		onOptimizeWithAi,
	}: {
		content: ContentDetail;
		draft?: OptimizationContent;
		onContentUpdated: (content: ContentDetail) => void;
		onOptimizeWithAi: (prompt: string) => void;
	} = $props();

	let refreshing = $state(false);
	let pollTimeout: ReturnType<typeof setTimeout> | undefined;
	const analysis = $derived(
		draft
			? analyzeOptimizationContent(draft, content.serpmanticsGuide)
			: content.serpmanticsAnalysis,
	);
	const metrics = $derived(getStructureMetrics(content.serpmanticsGuide, analysis));
	const addExpressions = $derived(content.serpmanticsGuide?.guide?.add ?? []);
	const avoidExpressions = $derived(content.serpmanticsGuide?.guide?.avoid ?? []);
	const score = $derived(Math.round(analysis?.score ?? content.score ?? 0));

	onMount(() => {
		void refresh();
		return () => clearTimeout(pollTimeout);
	});

	async function refresh() {
		if (refreshing || !content.serpmanticsGuideId) return;
		refreshing = true;
		try {
			const updated = await refreshOptimization({
				id: content.id,
				projectId: content.projectId,
			});
			onContentUpdated(updated);
			if (updated.serpmanticsStatus === "pending") {
				pollTimeout = setTimeout(refresh, 5_000);
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Analyse indisponible.", {
				richColors: true,
			});
		} finally {
			refreshing = false;
		}
	}

	async function retry() {
		refreshing = true;
		try {
			const updated = await retryOptimizationGuide({ id: content.id, projectId: content.projectId });
			onContentUpdated(updated);
			pollTimeout = setTimeout(refresh, 2_000);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Nouveau guide impossible.", { richColors: true });
		} finally {
			refreshing = false;
		}
	}

	function occurrence(expression: SerpmanticsExpression) {
		return analysis?.expressions?.[expression.expression] ?? 0;
	}

	function expressionState(expression: SerpmanticsExpression) {
		if (expression.from == null || expression.to == null) return occurrence(expression) > 0 ? "remove" : "valid";
		return getOptimizationState(occurrence(expression), { from: expression.from, to: expression.to });
	}

	function resultUrl(result: Record<string, unknown>) {
		return String(result.url ?? result.link ?? result.href ?? "Résultat non pris en compte");
	}

	function resultScore(result: Record<string, unknown>) {
		const value = result.score ?? (result.contentAnalysis as Record<string, unknown> | undefined)?.score;
		return typeof value === "number" ? Math.round(value) : null;
	}
</script>

{#if content.serpmanticsStatus === "pending"}
	<section class="PanelCard LoadingState">
		<span class="loading loading-spinner loading-lg text-primary"></span>
		<h2>Création du guide SERPmantics</h2>
		<p>L’analyse des résultats Google est en cours. Cette page s’actualisera automatiquement.</p>
	</section>
{:else if content.serpmanticsStatus === "failed" || !content.serpmanticsGuideId}
	<section class="PanelCard LoadingState ErrorState">
		<h2>Guide SERPmantics indisponible</h2>
		<p>{content.serpmanticsError || "Le guide n’a pas pu être créé."}</p>
		<button class="btn btn-primary" disabled={refreshing} onclick={retry}>Réessayer</button>
	</section>
{:else}
	<section class="PanelCard ScoreCard">
		<header class="PanelTitleRow">
			<h2>Votre score</h2>
			<button class="AiButton" onclick={() => onOptimizeWithAi("Optimise à fond l’article en fonction des recommandations SERPmantics, puis relance l’analyse.")}>
				<IconSparkleRegular class="icon" /> Optimiser via IA
			</button>
		</header>
		<div class="ScoreIntro">
			<OptimizationScore {score} variant="card" caption={score >= 50 ? "Bon" : "À améliorer"} />
			<p>
				<strong>{score >= 50 ? "Votre texte est meilleur que 50% des pages de la 1ère page de Google." : "Votre contenu peut encore gagner en couverture sémantique."}</strong>
				{score >= 50 ? " Continuez à insérer les expressions ci-dessous pour dépasser 75% de vos concurrents." : " Utilisez les recommandations ci-dessous pour progresser."}
			</p>
		</div>
		<div class="ScoreGauge">
			<div class="ScaleLabels"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span><span>120</span></div>
			<div class="ScoreScale">
				<span class="ScoreMarker" style:left={`${Math.min(100, (score / 120) * 100)}%`}></span>
			</div>
		</div>
		<div class="Legend"><span class="LegendSwatch valid"></span>Validé <span class="LegendSwatch add"></span>À ajouter <span class="LegendSwatch remove"></span>À enlever</div>
		<div class="MetricsGrid">
			{#each metrics as metric (metric.label)}
				<div class="Metric state-{metric.state}">
					<span class="MetricLabel" class:compact={metric.label.length >= 8}>{metric.label}</span>
					<div class="MetricValue">
						<strong>{metric.value}</strong>
						<span class="MetricState" aria-hidden="true">{metric.state === "valid" ? "✓" : metric.state === "add" ? "↗" : "×"}</span>
					</div>
					<small>{metric.range ? `${metric.range.from} à ${metric.range.to}` : "—"}</small>
				</div>
			{/each}
		</div>
	</section>

	<section class="PanelCard ExpressionCard">
		<header class="PanelTitleRow"><div><h2>Expressions à ajouter dans votre contenu</h2><p>Par ordre d’importance</p></div><button class="AiButton" onclick={() => onOptimizeWithAi("Ajoute naturellement les expressions manquantes recommandées par SERPmantics, sans sur-optimiser le texte.")}><IconSparkleRegular class="icon" /> Optimiser via IA</button></header>
		<div class="Legend"><span class="LegendSwatch valid"></span>Validé <span class="LegendSwatch add"></span>À ajouter <span class="LegendSwatch remove"></span>À enlever</div>
		<div class="ExpressionCloud">
			{#each addExpressions as expression (expression.expression)}
				<span class="Expression state-{expressionState(expression)}">
					<span class="ExpressionLabel">{expression.expression}</span>
					<span class="ExpressionMeta"><strong>{occurrence(expression)}</strong>{#if expression.from != null}<small>· {expression.from} à {expression.to}</small>{/if}</span>
				</span>
			{/each}
			{#if addExpressions.length === 0}<p class="Muted">Aucune expression supplémentaire.</p>{/if}
		</div>
	</section>

	<section class="PanelCard ExpressionCard">
		<header class="PanelTitleRow"><h2>Expressions à éviter</h2><button class="AiButton" onclick={() => onOptimizeWithAi("Réduis les expressions à éviter signalées par SERPmantics en conservant le sens de l’article.")}><IconSparkleRegular class="icon" /> Optimiser via IA</button></header>
		<div class="ExpressionCloud">
			{#each avoidExpressions as expression (expression.expression)}
				<span class="Expression avoid">{expression.expression}{#if occurrence(expression)} <strong>{occurrence(expression)}</strong>{/if}</span>
			{/each}
			{#if avoidExpressions.length === 0}<p class="Muted">Aucune expression à éviter.</p>{/if}
		</div>
	</section>

	<section class="PanelCard SerpCard">
		<header class="PanelTitleRow"><h2>Résultats de recherche</h2><button class="AiButton" onclick={() => onOptimizeWithAi("Compare l’article aux résultats de recherche analysés par SERPmantics et améliore ses lacunes prioritaires.")}><IconSparkleRegular class="icon" /> Optimiser via IA</button></header>
		<div class="SerpList">
			{#each content.serpmanticsGuide?.topSERPResultsDetails ?? [] as result, index}
				<div class="SerpResult">
					<span class="Position">{index + 1}</span>
					<div class="ResultContent">
						{#if resultUrl(result).startsWith("http")}
							<a class="ResultLink" href={resultUrl(result)} target="_blank" rel="noopener noreferrer">{resultUrl(result)}</a>
						{:else}
							<strong>{resultUrl(result)}</strong>
						{/if}
						{#if resultScore(result) != null}<OptimizationScore score={resultScore(result)} />{/if}
					</div>
				</div>
			{/each}
			{#if (content.serpmanticsGuide?.topSERPResultsDetails?.length ?? 0) === 0}<p class="Muted">Les détails des résultats ne sont pas disponibles.</p>{/if}
		</div>
	</section>
{/if}

<style>
	.LoadingState { min-height: 20rem; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 0.75rem; color: var(--color-text-light); }
	.LoadingState h2 { color: var(--color-base-content); font-size: 1.4rem; font-weight: 650; }
	.ErrorState { color: var(--color-error); }
	.PanelTitleRow { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
	.PanelTitleRow h2 { font-size: calc(1.45rem - 2px); font-weight: 500; line-height: 1.2; color: #4b4b4b; }
	.PanelTitleRow p { margin-top: 0.15rem; color: var(--color-text-light); font-size: 1rem; line-height: 1.25; }
	.AiButton { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 0.35rem; border: 1px solid #dbc7ff; color: var(--color-primary); padding: 0.55rem 0.7rem; border-radius: 0.7rem; cursor: pointer; white-space: nowrap; font-size: 0.9rem; }
	.AiButton :global(.icon) { width: 1.15rem; height: 1.15rem; }
	.ScoreCard, .ExpressionCard, .SerpCard { display: flex; flex-direction: column; gap: 1rem; }
	.ScoreCard .PanelTitleRow h2 { white-space: nowrap; }
	.ScoreIntro { display: flex; align-items: center; gap: 0.9rem; }
	.ScoreIntro p { flex: 1; font-size: 1rem; line-height: 1.3; }
	.ScoreGauge { display: flex; flex-direction: column; gap: 0.3rem; }
	.ScaleLabels { display: flex; justify-content: space-between; color: var(--color-text-light); font-size: 0.9rem; line-height: 1; }
	.ScoreScale { height: 0.8rem; border-radius: 1rem; background: linear-gradient(90deg,#f4514b 0%,#ffb400 20%,#81d51f 42%,#14be8b 72%,#a0a0a0 100%); position: relative; }
	.ScoreMarker { position: absolute; top: -0.35rem; bottom: -0.35rem; width: 0.45rem; border: 1px solid #bdbdbd; border-radius: 0.25rem; background: white; transform: translateX(-50%); box-shadow: 0 1px 2px rgb(0 0 0 / 12%); }
	.Legend { display: flex; align-items: center; flex-wrap: wrap; column-gap: 0.45rem; row-gap: 0.5rem; font-size: calc(0.9rem - 1px); }
	.LegendSwatch { width: 1.4rem; height: 1.4rem; border-radius: 0.3rem; }
	.LegendSwatch:not(:first-child) { margin-left: 1rem; }
	.LegendSwatch.valid { background: #b8fac4; }
	.LegendSwatch.add { background: #ffe6a0; }
	.LegendSwatch.remove { background: #ffc4c7; }
	.MetricsGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: repeat(2, 6.1rem); grid-auto-rows: 6.1rem; gap: 0.4rem; }
	.Metric { width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; border: 1px solid var(--color-border); border-radius: 0.65rem; padding: 0.6rem 0.2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
	.MetricLabel { width: 100%; color: var(--color-text-light); font-size: 14px; line-height: 1.05; white-space: nowrap; }
	.MetricLabel.compact { font-size: 12px; letter-spacing: -0.02em; }
	.MetricValue { display: flex; align-items: center; justify-content: center; gap: calc(0.25rem + 2px); }
	.Metric strong { font-size: 2rem; font-weight: 500; line-height: 1.1; }
	.MetricState { width: 1rem; height: 1rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 0.25rem; font-size: 0.68rem; font-weight: 700; }
	.Metric.state-valid strong { color: #08751f; }
	.Metric.state-valid .MetricState { color: #08751f; background: #b8fac4; }
	.Metric.state-add strong { color: #d56b00; }
	.Metric.state-add .MetricState { color: #8a5700; background: #ffe6a0; }
	.Metric.state-remove strong { color: #a90e15; }
	.Metric.state-remove .MetricState { color: #a90e15; background: #ffc4c7; }
	.Metric small { color: var(--color-text-light); line-height: 1.15; }
	.ExpressionCloud { display: flex; flex-wrap: wrap; gap: 0.35rem; }
	.Expression { display: inline-flex; align-items: center; gap: 0.25rem; border-radius: 0.55rem; padding: 0.25rem 0.3rem 0.25rem 0.5rem; font-size: 1rem; line-height: 1.2; }
	.Expression.state-valid { background: #b8fac4; }
	.Expression.state-add { background: #ffe6a0; }
	.Expression.state-remove { background: #ffc4c7; }
	.ExpressionMeta { display: inline-flex; align-items: baseline; gap: 0.2rem; padding: 0.15rem 0.3rem; border-radius: 0.35rem; background: rgb(255 255 255 / 70%); white-space: nowrap; }
	.ExpressionMeta strong { font-size: 1.05rem; }
	.Expression.avoid { background: #ededed; }
	.Expression small { font-size: 0.8rem; }
	.SerpList { display: flex; flex-direction: column; }
	.SerpResult { display: flex; align-items: center; gap: 0.65rem; padding: 0.65rem 0; border-bottom: 1px solid var(--color-border); }
	.Position { width: 2.1rem; height: 2.1rem; border-radius: 0.35rem; background: #f0f2f6; display: inline-flex; align-items: center; justify-content: center; }
	.ResultContent { min-width: 0; flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
	.ResultContent strong, .ResultLink { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: calc(1rem - 2px); font-weight: 650; }
	.ResultLink:hover { color: var(--color-primary); text-decoration: underline; }
	.Muted { color: var(--color-text-light); }
	@media (max-width: 520px) {
		.PanelTitleRow { gap: 0.65rem; }
		.PanelTitleRow h2 { font-size: calc(1.25rem - 2px); }
		.AiButton { padding: 0.5rem 0.6rem; font-size: 0.85rem; }
		.ScoreIntro { align-items: flex-start; gap: 0.65rem; }
		.ScoreIntro p { font-size: 0.9rem; }
		.MetricsGrid { grid-template-rows: repeat(2, 5.6rem); grid-auto-rows: 5.6rem; }
		.MetricLabel { font-size: 14px; }
		.MetricLabel.compact { font-size: 12px; }
		.Metric small { font-size: 0.78rem; }
		.Metric strong { font-size: 1.8rem; }
		.LegendSwatch:not(:first-child) { margin-left: 0.45rem; }
	}
</style>

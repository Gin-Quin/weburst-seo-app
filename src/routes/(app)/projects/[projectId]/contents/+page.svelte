<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import Loader from "$lib/components/Loader.svelte";
	import OptimizationScore from "$lib/components/OptimizationScore.svelte";
	import type { ContentPriority, ContentStatus } from "$lib/server/db/schema";
	import { context } from "$lib/stores/context.svelte";
	import IconArchiveRegular from "phosphor-icons-svelte/IconArchiveRegular.svelte";
	import IconArrowCounterClockwiseRegular from "phosphor-icons-svelte/IconArrowCounterClockwiseRegular.svelte";
	import IconBrainRegular from "phosphor-icons-svelte/IconBrainRegular.svelte";
	import IconPlusRegular from "phosphor-icons-svelte/IconPlusRegular.svelte";
	import { toast } from "svelte-sonner";
	import {
		archiveContent,
		listContents,
	} from "../../../../api/contents/contents.remote";
	import CreateContentDialog from "./components/CreateContentDialog.svelte";
	import ClientContextDialog from "./components/ClientContextDialog.svelte";

	const projectId = $derived(page.params.projectId!);
	let archived = $state(false);
	let openCreateContentDialog = $state<(() => void) | undefined>();
	let openClientContextDialog = $state<(() => void) | undefined>();
	const contentsQuery = $derived(listContents({ projectId, archived }));

	const statusLabels: Record<ContentStatus, string> = {
		new: "Nouveau",
		in_progress: "En cours",
		done: "Fait",
	};
	const priorityLabels: Record<ContentPriority, string> = {
		high: "Haute",
		moderate: "Modérée",
		low: "Faible",
	};

	async function toggleArchive(id: string) {
		try {
			await archiveContent({ id, projectId, archived: !archived });
			toast.success(archived ? "Contenu restauré" : "Contenu archivé", {
				richColors: true,
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Action impossible.", {
				richColors: true,
			});
		}
	}

	function requestArchive(id: string) {
		if (archived) {
			void toggleArchive(id);
			return;
		}

		context.openConfirmDialog?.({
			title: "Archiver ce contenu&nbsp;?",
			description:
				"Le contenu ne sera plus visible dans la liste des contenus actifs.",
			confirmLabel: "Oui, archiver le contenu",
			color: "error",
			then: () => toggleArchive(id),
		});
	}

	function formatDate(timestamp: number) {
		return new Intl.DateTimeFormat("fr-FR", {
			day: "numeric",
			month: "short",
			year: "numeric",
		}).format(timestamp);
	}
</script>

<svelte:head><title>Contenus</title></svelte:head>

<CreateContentDialog {projectId} bind:openCreateContentDialog />
{#if context.project?.clientId}
	<ClientContextDialog clientId={context.project.clientId} bind:openClientContextDialog />
{/if}

<div class="ContentsPage">
	<header class="ContentsHeader">
		<h1>Voici vos <span>contenus</span>.</h1>
		<div class="ContentsActions">
			<button
				class="btn control-size-2"
				disabled={!context.project?.clientId}
				onclick={() => openClientContextDialog?.()}
			>
				<IconBrainRegular class="icon text-accent" />
				Contexte du client
			</button>
			<button class="btn control-size-2" onclick={() => openCreateContentDialog?.()}>
				<IconPlusRegular class="icon text-accent" />
				Créer un contenu
			</button>
		</div>
	</header>

	{#await contentsQuery}
		<div class="center min-h-72"><Loader /></div>
	{:then rows}
		<div class="ContentsTableWrap">
			{#if rows.length === 0}
				<div class="EmptyContents">
					<p>{archived ? "Aucun contenu archivé." : "Aucun contenu pour le moment."}</p>
					{#if !archived}
						<button class="btn btn-primary" onclick={() => openCreateContentDialog?.()}>
							<IconPlusRegular class="icon" /> Créer le premier contenu
						</button>
					{/if}
				</div>
			{:else}
				<table class="ContentsTable">
					<thead>
						<tr>
							<th>Nom</th>
							<th>Date de modif.</th>
							<th>Date de création</th>
							<th>Typologie</th>
							<th>Clusters</th>
							<th>Statut</th>
							<th>Priorité</th>
							<th>Score</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as content (content.id)}
							<tr onclick={() => goto(`/projects/${projectId}/contents/${content.id}`)}>
								<td class="ContentName">{content.title}</td>
								<td>{formatDate(content.updatedAt)}</td>
								<td>{formatDate(content.createdAt)}</td>
								<td><span class="NeutralBadge">—</span></td>
								<td>
									<span class="NeutralBadge">{content.cluster || "Pas de cluster lié"}</span>
								</td>
								<td><span class="StatusBadge status-{content.status}">{statusLabels[content.status]}</span></td>
								<td>
									{#if content.priority}
										<span class="PriorityBadge priority-{content.priority}">{priorityLabels[content.priority]}</span>
									{:else}—{/if}
								</td>
								<td>
									<OptimizationScore score={content.score} label="" suffix="%" />
								</td>
								<td>
									<button
										class="btn control-size-1 ActionButton"
										title={archived ? "Restaurer" : "Archiver"}
									onclick={(event) => {
										event.stopPropagation();
										requestArchive(content.id);
									}}
									>
										{#if archived}<IconArrowCounterClockwiseRegular class="icon" />{:else}<IconArchiveRegular class="icon" />{/if}
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/await}
</div>

<style>
	.ContentsPage {
		padding: 2rem 2.5rem;
		min-height: calc(100dvh - var(--app-header-height));
	}

	.ContentsHeader,
	.ContentsActions {
		display: flex;
		align-items: center;
	}

	.ContentsHeader {
		justify-content: space-between;
		gap: 2rem;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: clamp(2rem, 4vw, 3rem);
		letter-spacing: -0.04em;
		white-space: nowrap;
	}

	h1 span {
		color: var(--color-primary);
	}

	.ContentsActions {
		gap: 0.75rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.ContentsTableWrap {
		background: var(--color-base-100);
		border: 1px solid var(--color-border);
		border-radius: 1.5rem;
		padding: 0.75rem;
		overflow-x: auto;
	}

	.ContentsTable {
		width: 100%;
		min-width: 1040px;
		border-collapse: collapse;
	}

	.ContentsTable th,
	.ContentsTable td {
		text-align: left;
		padding: 0.75rem 0.65rem;
		white-space: nowrap;
	}

	.ContentsTable th {
		border-bottom: 1px solid var(--color-border);
		font-size: 0.85rem;
	}

	.ContentsTable tbody tr {
		cursor: pointer;
		transition: background 120ms ease;
	}

	.ContentsTable tbody tr:hover {
		background: var(--color-base-300);
	}

	.ContentsTable td {
		color: var(--color-text-light);
		font-weight: 500;
	}

	.ContentName {
		color: var(--color-base-content) !important;
		font-weight: 650 !important;
		max-width: 250px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.NeutralBadge,
	.StatusBadge,
	.PriorityBadge {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--color-border);
		border-radius: 0.6rem;
		padding: 0.3rem 0.6rem;
		color: var(--color-base-content);
		background: var(--color-base-100);
	}

	.status-new,
	.priority-low {
		background: #eef4ff;
		border-color: #bcd2ff;
		color: #173372;
	}

	.status-in_progress,
	.priority-moderate {
		background: #fff8e8;
		border-color: #ffdc83;
		color: #673700;
	}

	.status-done {
		background: #e9ffee;
		border-color: #a5f3b3;
		color: #0d7021;
	}

	.priority-high {
		background: #fff1f1;
		border-color: #ffc1c1;
		color: #8f2222;
	}

	.ActionButton {
		padding-inline: 0.6rem;
	}

	.EmptyContents {
		min-height: 18rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		color: var(--color-text-light);
	}

	@media (max-width: 960px) {
		.ContentsHeader {
			align-items: flex-start;
			flex-direction: column;
		}
		.ContentsActions {
			justify-content: flex-start;
		}
	}

	@media (max-width: 640px) {
		.ContentsPage { padding: 1rem; }
		h1 { white-space: normal; }
	}
</style>

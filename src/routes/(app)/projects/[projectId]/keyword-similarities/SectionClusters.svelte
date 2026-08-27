<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
	import { getChartColor } from "$lib/charts/chartColors";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { groupSimilarityResultsByCluster } from "$lib/keywords/groupSimilarityResultsByCluster";
	import type { KeywordCluster } from "$lib/server/clickhouse/services/keywords";
	import { context } from "$lib/stores/context.svelte";

	const content = defineContent({
		en: {
			title: "Clusters",
			description:
				"Discover related keyword clusters: main keyword, volume, and secondary keywords.",
			mainKeyword: "Main Keyword",
			cluster: "Cluster",
			keywordVolume: "Volume",
			associatedKeywords: "Secondary Keywords",
			positionnedPages: "Positionned Pages",
			noPosition: "No page positionned",
		},
		fr: {
			title: "Groupes similaires",
			description:
				"Découvrez les groupes de mots-clés liés : mot-clé principal, volume et mots-clés secondaires.",
			mainKeyword: "Mot-clé principal",
			cluster: "Cluster",
			keywordVolume: "Volume",
			associatedKeywords: "Mots-clés secondaires",
			positionnedPages: "Pages positionnées",
			noPosition: "Aucune page positionnée",
		},
	});

	let {
		clusters,
		clusterNames,
	}: {
		clusters: Array<KeywordCluster>;
		clusterNames: string[];
	} = $props();

	const showClusterColumn = $derived(clusterNames.length >= 2);
	const clusterGroups = $derived(
		groupSimilarityResultsByCluster(clusters, clusterNames),
	);

	function getClusterColor(clusterName: string): string {
		const index = clusterNames.indexOf(clusterName);
		return getChartColor(Math.max(0, index));
	}
</script>

{#snippet clusterChip(clusterName: string)}
	<span
		class="ClusterChip"
		title={clusterName}
		style={`--cluster-color: ${getClusterColor(clusterName)}`}
	>
		<span class="ClusterChipLabel">{clusterName}</span>
	</span>
{/snippet}

<div class="card w-full min-w-0">
	<header class="shrink-0">
		<div class="title">
			{$content.title}
		</div>
		<div class="description">
			{$content.description}
		</div>
	</header>

	<main class="col justify-stretch w-full grow">
		<Table.Root
			class={showClusterColumn ? "w-full min-w-[800px] table-fixed" : "w-full"}
		>
			<Table.Header>
				<Table.Row class="border-none h-9">
					<Table.Head class={showClusterColumn ? "w-[18%]" : ""}>
						{$content.mainKeyword}
					</Table.Head>
					{#if showClusterColumn}
						<Table.Head class="w-[19%]">
							{$content.cluster}
						</Table.Head>
					{/if}
					<Table.Head class="w-[120px] text-center">
						{$content.keywordVolume}
					</Table.Head>
					<Table.Head class={showClusterColumn ? "w-[31%]" : ""}>
						{$content.associatedKeywords}
					</Table.Head>
					<Table.Head class="text-center">
						{$content.positionnedPages}
					</Table.Head>
				</Table.Row>
			</Table.Header>

			<Table.Body class="Body">
				{#each clusterGroups as clusterGroup (clusterGroup.name ?? "__unclustered")}
					{#each clusterGroup.results as cluster (cluster[0]?.keyword)}
						{@const mainVolume = cluster[0]?.volume ?? 0}
						{@const totalVolume = cluster.reduce((acc, { volume }) => acc + volume, 0)}
						<Table.Row class="border-none h-9">
							<Table.Cell
								class={showClusterColumn
									? "whitespace-normal text-[13px] font-medium"
									: "text-[13px] font-medium"}
							>
								{cluster[0]?.keyword ?? ""}
							</Table.Cell>
							{#if showClusterColumn}
								<Table.Cell class="whitespace-normal text-[13px] font-medium">
									{#if cluster[0]?.clusters}
										{@render clusterChip(cluster[0].clusters)}
									{:else}
										-
									{/if}
								</Table.Cell>
							{/if}
							<Table.Cell class="text-center text-[13px]">
								<div class="flex items-center justify-center gap-1">
									<span class="text-xs font-bold text-info-purple">
										{mainVolume}
									</span>
									{#if totalVolume !== mainVolume}
										<span class="text-base-content font-normal">/</span>
										<span class="text-xs font-bold text-info-purple">
											{totalVolume}
										</span>
									{/if}
								</div>
							</Table.Cell>
							<Table.Cell
								class={showClusterColumn
									? "max-w-[500px] whitespace-normal py-3 text-[13px] font-medium"
									: "max-w-[500px] py-3 text-[13px] font-medium"}
							>
								<div class="col items-start gap-1">
									{#each cluster.slice(1) as { keyword, volume }}
										<div class="center gap-1">
											<div>
												{keyword}
											</div>
											<div class="translate-y-[1px] text-[11px] font-bold text-info-purple">
												{volume}
											</div>
										</div>
									{/each}
								</div>
							</Table.Cell>
							<Table.Cell
								class={showClusterColumn
									? "whitespace-normal text-center text-[13px]"
									: "text-center text-[13px]"}
							>
								{@const items = cluster
									.flatMap((cluster) => cluster.items)
									.filter((item) => item.domain == context.project!.domain)}
								<div class="col items-center gap-1">
									{#if items.length == 0}
										<div class="center text-[#777] w-full">-</div>
									{:else}
										{#each items as item}
											<div class="center text-center gap-1">
												<a
													class={showClusterColumn ? "link break-all" : "link"}
													href={item.url}
													target="_blank"
													rel="noopener noreferrer"
												>
													{item.url}
												</a>
											</div>
										{/each}
									{/if}
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				{/each}
			</Table.Body>
		</Table.Root>
	</main>
</div>

<style>
	.ClusterChip {
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		padding: 0.25rem 0.625rem;
		border: 1px solid color-mix(in srgb, var(--cluster-color) 55%, transparent);
		border-radius: 9999px;
		background: color-mix(in srgb, var(--cluster-color) 20%, var(--color-base-100));
		color: color-mix(in srgb, var(--cluster-color) 55%, var(--color-base-content));
		font-size: 0.75rem;
		font-weight: 650;
		line-height: 1.25;
		text-align: left;
		white-space: nowrap;
	}

	.ClusterChipLabel {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>

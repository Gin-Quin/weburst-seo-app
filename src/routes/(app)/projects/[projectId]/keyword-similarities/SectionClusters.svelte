<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { KeywordCluster } from "$lib/server/clickhouse/services/keywords";
	import { context } from "$lib/stores/context.svelte";

	const content = defineContent({
		en: {
			title: "Clusters",
			description:
				"Discover related keyword clusters: main keyword, volume, and secondary keywords.",
			mainKeyword: "Main Keyword",
			keywordVolume: "Main Keyword Volume",
			associatedKeywords: "Secondary Keywords",
			totalVolume: "Total Volume",
			positionnedPages: "Positionned Pages",
			noPosition: "No page positionned",
		},
		fr: {
			title: "Groupes similaires",
			description:
				"Découvrez les groupes de mots-clés liés : mot-clé principal, volume et mots-clés secondaires.",
			mainKeyword: "Mot-clé principal",
			keywordVolume: "Volume du mot-clé principal",
			associatedKeywords: "Mots-clés secondaires",
			totalVolume: "Volume total",
			positionnedPages: "Pages positionnées",
			noPosition: "Aucune page positionnée",
		},
	});

	let {
		clusters,
	}: {
		clusters: Array<KeywordCluster>;
	} = $props();
</script>

<div class="card">
	<header>
		<div class="title">
			{$content.title}
		</div>
		<div class="description">
			{$content.description}
		</div>
	</header>

	<main class="col justify-stretch w-full grow overflow-auto">
		<Table.Root class="table-fixed">
			<Table.Header>
				<Table.Row class="border-none h-9">
					<Table.Head class="w-[12rem]">
						{$content.mainKeyword}
					</Table.Head>
					<Table.Head>
						{$content.associatedKeywords}
					</Table.Head>
					<Table.Head class="text-center w-[13rem]">
						{$content.keywordVolume}
					</Table.Head>
					<Table.Head class="text-center w-[13rem]">
						{$content.totalVolume}
					</Table.Head>
					<Table.Head class="text-center">
						{$content.positionnedPages}
					</Table.Head>
				</Table.Row>
			</Table.Header>

			<Table.Body class="Body">
				{#each clusters as cluster (cluster[0]?.keyword)}
					<Table.Row class="border-none h-9">
						<Table.Cell class="text-xs font-medium">
							<div>
								<span>
									{cluster[0]?.keyword ?? ""}
								</span>
								<span
									class="text-[0.625rem] font-bold text-info-purple translate-y-[1px]"
								>
									{cluster[0]?.volume ?? 0}
								</span>
							</div>
						</Table.Cell>
						<Table.Cell class="text-xs font-medium max-w-[500px] py-3">
							<div class="col items-start gap-1">
								{#each cluster.slice(1) as { keyword, volume }}
									<div class="center gap-1">
										<div>
											{keyword}
										</div>
										<div
											class="text-[0.625rem] font-bold text-info-purple translate-y-[1px]"
										>
											{volume}
										</div>
									</div>
								{/each}
							</div>
						</Table.Cell>
						<Table.Cell class="text-xs text-center">
							<div class="badge badge-info-purple text-xs">
								{cluster[0]?.volume ?? 0}
							</div>
						</Table.Cell>
						<Table.Cell class="text-xs text-center">
							<div class="badge badge-info-purple text-xs">
								{cluster.reduce((acc, { volume }) => acc + volume, 0)}
							</div>
						</Table.Cell>

						<Table.Cell class="text-xs text-center">
							{@const items = cluster
								.flatMap((cluster) => cluster.items)
								.filter((item) => item.domain == context.project!.domain)}
							<div class="col items-start gap-1">
								{#if items.length == 0}
									<div class="center text-[#777] w-full">-</div>
								{:else}
									{#each items as item}
										<div class="center gap-1">
											{item.url}
										</div>
									{/each}
								{/if}
							</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</main>
</div>

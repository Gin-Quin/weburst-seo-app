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
			keywordVolume: "Volume",
			associatedKeywords: "Mots-clés secondaires",
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
		<Table.Root class="w-full">
			<Table.Header>
				<Table.Row class="border-none h-9">
					<Table.Head class="">
						{$content.mainKeyword}
					</Table.Head>
					<Table.Head class="w-[120px] text-center">
						{$content.keywordVolume}
					</Table.Head>
					<Table.Head class="">
						{$content.associatedKeywords}
					</Table.Head>
					<Table.Head class="text-center">
						{$content.positionnedPages}
					</Table.Head>
				</Table.Row>
			</Table.Header>

			<Table.Body class="Body">
				{#each clusters as cluster (cluster[0]?.keyword)}
					{@const mainVolume = cluster[0]?.volume ?? 0}
					{@const totalVolume = cluster.reduce((acc, { volume }) => acc + volume, 0)}
					<Table.Row class="border-none h-9">
						<Table.Cell class="text-[13px] font-medium">
							{cluster[0]?.keyword ?? ""}
						</Table.Cell>
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
						<Table.Cell class="max-w-[500px] py-3 text-[13px] font-medium">
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
						<Table.Cell class="text-center text-[13px]">
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
												class="link"
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
			</Table.Body>
		</Table.Root>
	</main>
</div>

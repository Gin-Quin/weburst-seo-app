<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import * as Table from "$lib/components/ui/table/index.js";
	import type {
		AggregatedKeywordAnalysis,
		AggregatedKeywordAnalysisData,
	} from "$lib/server/clickhouse/services/keywords";
	import { formatPercent } from "$lib/numbers/formatPercent";
	import IconEyeBold from "phosphor-icons-svelte/IconEyeBold.svelte";
	import type { SvelteSet } from "svelte/reactivity";
	import Trend from "$lib/components/Trend.svelte";

	const content = defineContent({
		en: {
			title: "Leaders",
			description: "Ranking of competing domains sorted by share of voice.",
			domain: "Domain",
			shareOfVoice: "Share of voice",
		},
		fr: {
			title: "Leaders",
			description:
				"Classement des domaines concurrents triés par part de voix.",
			domain: "Domaine",
			shareOfVoice: "Part de voix",
		},
	});

	let {
		analysisResultsWithTrend,
		visibleDomains,
		client,
	}: {
		analysisResultsWithTrend: AggregatedKeywordAnalysis;
		visibleDomains: SvelteSet<string>;
		client: AggregatedKeywordAnalysisData;
	} = $props();

	const { data, totalTraffic } = $derived(analysisResultsWithTrend);

	function toggleTop10Domains() {
		const allTop10DomainsSelected = data
			.slice(0, 10)
			.every(({ domain }) => visibleDomains.has(domain));

		visibleDomains.clear();
		if (allTop10DomainsSelected) {
			visibleDomains.add(client.domain);
		} else {
			for (const { domain } of data.slice(0, 10)) {
				visibleDomains.add(domain);
			}
		}
	}
</script>

<div class="card col justify-stretch">
	<header class="shrink-0">
		<div class="title">
			{$content.title}
		</div>
		<div class="description">
			{$content.description}
		</div>
	</header>

	<main
		class="LeadersTable col justify-stretch w-full grow overflow-x-hidden overflow-y-auto"
	>
		<Table.Root class="w-fit">
			<Table.Header>
				<Table.Row class="border-none h-9">
					<Table.Head></Table.Head>
					<Table.Head>
						{$content.domain}
					</Table.Head>
					<Table.Head class="text-center">
						{$content.shareOfVoice}
					</Table.Head>
					<Table.Head class="text-center">
						<button class="cursor-pointer azeaz" onclick={toggleTop10Domains}>
							<IconEyeBold class="icon m-auto" />
						</button>
					</Table.Head>
				</Table.Row>
			</Table.Header>

			<Table.Body>
				{#each data.slice(0, 100) as row, index (row.domain)}
					<Table.Row
						class="border-none h-9 cursor-pointer"
						onclick={() => {
							if (visibleDomains.has(row.domain)) {
								visibleDomains.delete(row.domain);
							} else {
								visibleDomains.add(row.domain);
							}
						}}
					>
						<Table.Cell>
							<div class="center size-8 bg-base-300 rounded-full">
								{index + 1}
							</div>
						</Table.Cell>
						<Table.Cell
							class=" {row.domain == client.domain
								? 'text-primary text-sm'
								: 'text-xs'}"
						>
							{row.domain}
						</Table.Cell>
						<Table.Cell class="h-full center gap-1 text-center">
							{formatPercent(row.volume / (totalTraffic || 1), {
								maximumFractionDigits: 0,
							})}
							<Trend trend={row.trend} size="xs" />
						</Table.Cell>
						<Table.Cell class="text-center">
							<input
								type="checkbox"
								class="checkbox"
								checked={visibleDomains.has(row.domain)}
							/>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</main>
</div>

<style>
	.card > .LeadersTable {
		padding-block-start: 0;
	}

	.LeadersTable :global([data-slot="table-container"]) {
		width: fit-content;
		overflow: visible;
	}
</style>

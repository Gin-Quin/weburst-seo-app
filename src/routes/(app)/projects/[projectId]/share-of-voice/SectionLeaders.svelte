<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import * as Table from "$lib/components/ui/table/index.js";
	import type { AggregatedKeywordAnalysis } from "$lib/server/clickhouse/services/keywords";
	import { formatPercent } from "$lib/numbers/formatPercent";
	import IconArrowUpRegular from "phosphor-icons-svelte/IconArrowUpRegular.svelte";
	import IconArrowDownRegular from "phosphor-icons-svelte/IconArrowDownRegular.svelte";
	import IconEyeBold from "phosphor-icons-svelte/IconEyeBold.svelte";
	import type { SvelteSet } from "svelte/reactivity";

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
	}: {
		analysisResultsWithTrend: AggregatedKeywordAnalysis | null;
		visibleDomains: SvelteSet<string>;
	} = $props();
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

	<main class="col justify-stretch w-full grow overflow-auto">
		{#if analysisResultsWithTrend == null}
			NO RESULT YET. START AN ANALYSIS.
		{:else}
			{@const { data, totalVolume } = analysisResultsWithTrend}

			<Table.Root>
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
							<IconEyeBold class="icon m-auto" />
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
							<Table.Cell class="text-xs">{row.domain}</Table.Cell>
							<Table.Cell class="h-full center gap-1 text-center">
								{formatPercent(row.volume / totalVolume, {
									maximumFractionDigits: 0,
								})}
								{#if row.trend && row.trend >= 0.1}
									<div class="badge badge-success">
										<IconArrowUpRegular class="text-small" />
										<span class="text-xs">
											{formatPercent(row.trend)}
										</span>
									</div>
								{:else if row.trend && row.trend < -0.1}
									<div class="badge badge-warning">
										<IconArrowDownRegular class="text-small" />
										<span class="text-xs">
											{formatPercent(row.trend)}
										</span>
									</div>
								{/if}
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
		{/if}
	</main>
</div>

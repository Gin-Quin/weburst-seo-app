import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type ClickHouseClient } from "@clickhouse/client";
import { getClusterHistory } from "$lib/keywords/getClusterHistory";
import { getWeightedVolume } from "$lib/keywords/getWeightedVolume";
import { getReclassifiedClusterRows } from "./reclassifiedClusterRows";

// Opt in against local ClickHouse; every run uses and removes its own database.
// TEST_CLICKHOUSE_URL=http://localhost:8125 TEST_CLICKHOUSE_PASSWORD=password bun test <this file>
describe.skipIf(!process.env.TEST_CLICKHOUSE_URL)("reclassification against ClickHouse", () => {
	const database = `test_reclassification_${crypto.randomUUID().replaceAll("-", "")}`;
	const oldSetId = crypto.randomUUID();
	const laterSetId = crypto.randomUUID();
	const currentSetId = crypto.randomUUID();
	const renamedSetId = crypto.randomUUID();
	const oldAnalysisId = crypto.randomUUID();
	const laterAnalysisId = crypto.randomUUID();
	let admin: ClickHouseClient;
	let client: ClickHouseClient;

	beforeAll(async () => {
		const url = process.env.TEST_CLICKHOUSE_URL!;
		if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) {
			throw new Error("Reclassification integration tests require a local ClickHouse server");
		}
		const config = {
			url,
			username: process.env.TEST_CLICKHOUSE_USERNAME ?? "default",
			password: process.env.TEST_CLICKHOUSE_PASSWORD ?? "",
		};
		admin = createClient(config);
		await admin.command({ query: `CREATE DATABASE ${database}` });
		client = createClient({ ...config, database });
		for (const query of [
			"CREATE TABLE keywords (setId UUID, name String, volume UInt32, clusters String) ENGINE = Memory",
			"CREATE TABLE keywordAnalysis (id UUID, setId UUID) ENGINE = Memory",
			"CREATE TABLE keywordAnalysisResponses (analysisId String, keyword String, domain String, position UInt32, type String) ENGINE = Memory",
		])
			await client.command({ query });
		await client.insert({
			table: "keywordAnalysis",
			format: "JSONEachRow",
			values: [
				{ id: oldAnalysisId, setId: oldSetId },
				{ id: laterAnalysisId, setId: laterSetId },
			],
		});
		await client.insert({
			table: "keywords",
			format: "JSONEachRow",
			values: [
				{ setId: oldSetId, name: "seo", volume: 100, clusters: "" },
				{ setId: oldSetId, name: "removed", volume: 300, clusters: "Old" },
				{ setId: oldSetId, name: "cleared", volume: 400, clusters: "Old" },
				{ setId: laterSetId, name: "seo", volume: 200, clusters: "Old" },
				{ setId: currentSetId, name: "seo", volume: 9999, clusters: " SEO " },
				{ setId: currentSetId, name: "cleared", volume: 9999, clusters: "" },
				{ setId: currentSetId, name: "new", volume: 9999, clusters: "New" },
				{ setId: renamedSetId, name: "seo", volume: 8888, clusters: "Renamed" },
			],
		});
		await client.insert({
			table: "keywordAnalysisResponses",
			format: "JSONEachRow",
			values: [
				{
					analysisId: oldAnalysisId,
					keyword: "seo",
					domain: "client.fr",
					position: 1,
					type: "organic",
				},
				{
					analysisId: oldAnalysisId,
					keyword: "seo",
					domain: "client.fr",
					position: 1,
					type: "organic",
				},
				{
					analysisId: laterAnalysisId,
					keyword: "seo",
					domain: "client.fr",
					position: 2,
					type: "organic",
				},
				{
					analysisId: oldAnalysisId,
					keyword: "removed",
					domain: "client.fr",
					position: 1,
					type: "organic",
				},
				{
					analysisId: oldAnalysisId,
					keyword: "cleared",
					domain: "client.fr",
					position: 1,
					type: "organic",
				},
				// An orphan response must not introduce a keyword absent from the crawl's set.
				{
					analysisId: oldAnalysisId,
					keyword: "new",
					domain: "client.fr",
					position: 1,
					type: "organic",
				},
			],
		});
	});

	afterAll(async () => {
		await client?.close();
		if (admin) {
			try {
				await admin.command({ query: `DROP DATABASE IF EXISTS ${database}` });
			} finally {
				await admin.close();
			}
		}
	});

	test("reclassifies multiple crawls using their own volumes and positions", async () => {
		const rows = await getReclassifiedClusterRows(client, {
			analysisIds: [oldAnalysisId, laterAnalysisId],
			currentSetId,
		});
		expect(rows).toHaveLength(2);
		expect(rows).toContainEqual({
			analysisId: oldAnalysisId,
			keyword: "seo",
			keywordVolume: 100,
			cluster: "SEO",
			domain: "client.fr",
			position: 1,
			type: "organic",
		});
		expect(rows).toContainEqual({
			analysisId: laterAnalysisId,
			keyword: "seo",
			keywordVolume: 200,
			cluster: "SEO",
			domain: "client.fr",
			position: 2,
			type: "organic",
		});
		const history = getClusterHistory(
			[
				{ id: oldAnalysisId, createdAt: "2026-09-01" },
				{ id: laterAnalysisId, createdAt: "2026-09-02" },
			],
			rows,
			"client.fr",
		);
		expect(history.map(({ volume }) => volume)).toEqual([
			getWeightedVolume(100, 1),
			getWeightedVolume(200, 2),
		]);
	});

	test("uses current cluster filters for both a snapshot and historical curves", async () => {
		expect(
			await getReclassifiedClusterRows(client, {
				analysisIds: [oldAnalysisId],
				currentSetId,
				clusterNames: ["SEO"],
			}),
		).toHaveLength(1);
		expect(
			await getReclassifiedClusterRows(client, {
				analysisIds: [oldAnalysisId, laterAnalysisId],
				currentSetId,
				clusterNames: ["Old", "New"],
			}),
		).toEqual([]);
	});

	test("takes a renamed cluster from a new import without a new crawl", async () => {
		const rows = await getReclassifiedClusterRows(client, {
			analysisIds: [oldAnalysisId],
			currentSetId: renamedSetId,
			clusterNames: ["Renamed"],
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ cluster: "Renamed", keywordVolume: 100, position: 1 });
	});

	test("leaves the original stored keyword labels and volumes intact", async () => {
		await getReclassifiedClusterRows(client, {
			analysisIds: [oldAnalysisId, laterAnalysisId],
			currentSetId,
		});
		const response = await client.query({
			query:
				"SELECT volume, clusters FROM keywords WHERE name = 'seo' AND setId IN {setIds:Array(UUID)} ORDER BY volume",
			query_params: { setIds: [oldSetId, laterSetId] },
			format: "JSON",
		});
		expect((await response.json()).data).toEqual([
			{ volume: 100, clusters: "" },
			{ volume: 200, clusters: "Old" },
		]);
	});
});

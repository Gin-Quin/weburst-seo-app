/**
 * After adding a migration, update this types as well.
 */

export namespace ClickhouseTable {
	export type KeywordSet = {
		id: string; // UUID
		createdAt: string;
		projectId: string;
	};

	export type Keyword = {
		setId: string; // UUID
		name: string;
		volume: number; // UInt32
	};

	export type KeywordAnalysis = {
		id: string; // UUID
		projectId: string;
		createdAt: string;
		setId: string; // UUID
		status: "pending" | "completed" | "failed";
		error?: string;
	};

	export type KeywordAnalysisTask = {
		id: string; // UUID
		analysisId: string; // UUID
		createdAt: string;
		status: "pending" | "completed" | "failed";
		error?: string;
	};

	export type KeywordAnalysisTaskResult = {
		analysisId: string; // UUID
		taskId: string; // UUID
		status: "completed" | "failed";
		itemCount: number; // UInt32
		error: string;
		createdAt: string;
		version: number; // UInt64
	};

	export type KeywordAnalysisResponse = {
		analysisId: string; // UUID
		taskId: string; // UUID
		createdAt: string;
		keyword: string;
		position: number; // UInt8
		domain: string;
		url: string;
		type: string;
		title: string;
		description: string;
	};

	export type AggregatedKeywordAnalysisData = {
		analysisId: string; // UUID
		createdAt: string;
		domain: string;
		volume: number;
		topThreeKeywordCount: number;
		topTenKeywordCount: number;
		positionnedKeywordCount: number;
		trend?: number;
	};
}

export type ClickhouseMigration = {
	name: string;
	query: (database: string) => string | Array<string>;
};

export const clickhouseMigrations: Array<ClickhouseMigration> = [
	{
		name: "test",
		query: (database: string) =>
			`CREATE TABLE ${database}.test (id UInt64) ENGINE = MergeTree PRIMARY KEY id`,
	},
	{
		name: "keywordSets",
		query: (database: string) =>
			`CREATE TABLE IF NOT EXISTS ${database}.keywordSets
				(
				  id UUID DEFAULT generateUUIDv4(),
				  createdAt DateTime DEFAULT now()
				)
				ENGINE = MergeTree
				ORDER BY (id);
			`,
	},
	{
		name: "keywords",
		query: (database: string) =>
			`CREATE TABLE IF NOT EXISTS ${database}.keywords
				(
				  setId UUID,
				  keyword String,
				  volume UInt32
				)
				ENGINE = MergeTree
				ORDER BY (setId, volume);
			`,
	},
	{
		name: "Add project id to keywordSets",
		query: (database: string) => `ALTER TABLE ${database}.keywordSets ADD COLUMN projectId String`,
	},
	{
		name: "Add keywordAnalysisTasks table",
		query: (database: string) =>
			`CREATE TABLE IF NOT EXISTS ${database}.keywordAnalysisTasks
				(
				  id UUID,
				  createdAt DateTime DEFAULT now(),
				  projectId String,
					setId UUID,
					batchIndex UInt32,
				  status String
				)
				ENGINE = MergeTree
				ORDER BY (createdAt);
			`,
	},
	{
		name: "Add keywordAnalysisResponses table",
		query: (database: string) =>
			`CREATE TABLE IF NOT EXISTS ${database}.keywordAnalysisResponses
				(
				  projectId LowCardinality(String),
				  setId UUID,
				  createdAt DateTime DEFAULT now(),
				  keyword String,
					volume UInt32,
					position UInt8,
					domain String,
					url String,
					type String,
					title String,
					serpFeatures String,
					snippet String
				)
				ENGINE = MergeTree
				PARTITION BY toYYYYMM(createdAt)
				ORDER BY (projectId, createdAt);
			`,
	},
	{
		name: "Remove 'volume' column from keywordAnalysisResponses",
		query: (database: string) =>
			`ALTER TABLE ${database}.keywordAnalysisResponses DROP COLUMN volume`,
	},
	{
		name: "Remove 'serpFeatures' column from keywordAnalysisResponses",
		query: (database: string) =>
			`ALTER TABLE ${database}.keywordAnalysisResponses DROP COLUMN serpFeatures`,
	},
	{
		name: "Rename 'snippet' column to 'description'",
		query: (database: string) =>
			`ALTER TABLE ${database}.keywordAnalysisResponses RENAME COLUMN snippet TO description`,
	},
	{
		name: "Add keywordAnalysis table",
		query: (database: string) =>
			`CREATE TABLE IF NOT EXISTS ${database}.keywordAnalysis
				(
				  id UUID,
				  createdAt DateTime DEFAULT now(),
				  projectId String,
					setId UUID,
					status String
				)
				ENGINE = MergeTree
				ORDER BY (projectId, createdAt);
			`,
	},
	{
		name: "Add analysisId column to keywordAnalysisTasks",
		query: (database: string) =>
			`ALTER TABLE ${database}.keywordAnalysisTasks ADD COLUMN analysisId UUID`,
	},
	{
		name: "Remove setId columns in keywordAnalysisTasks",
		query: (database: string) => `ALTER TABLE ${database}.keywordAnalysisTasks DROP COLUMN setId`,
	},
	{
		name: "Add analysisId column to keywordAnalysisResponses",
		query: (database: string) =>
			`ALTER TABLE ${database}.keywordAnalysisResponses ADD COLUMN analysisId UUID`,
	},
	{
		name: "Remove setId columns in keywordAnalysisResponses",
		query: (database: string) =>
			`ALTER TABLE ${database}.keywordAnalysisResponses DROP COLUMN setId`,
	},
	{
		name: "Add column error for keywordAnalysis",
		query: (database: string) =>
			`ALTER TABLE ${database}.keywordAnalysis ADD COLUMN error String DEFAULT ''`,
	},
	{
		name: "Add column error for keywordAnalysisTasks",
		query: (database: string) =>
			`ALTER TABLE ${database}.keywordAnalysisTasks ADD COLUMN error String DEFAULT ''`,
	},
	{
		name: "Add column taskId for keywordAnalysisResponses",
		query: (database: string) =>
			`ALTER TABLE ${database}.keywordAnalysisResponses ADD COLUMN taskId UUID`,
	},
	{
		name: "Rename column 'keyword' to 'name' in keywords table",
		query: (database: string) => `ALTER TABLE ${database}.keywords RENAME COLUMN keyword TO name`,
	},
	{
		name: "Remove column 'analysisId' from keywordAnalysisResponses",
		query: (database: string) =>
			`ALTER TABLE ${database}.keywordAnalysisResponses DROP COLUMN analysisId`,
	},
	{
		name: "Create keywordAnalysisResponses_new table without projectId",
		query: (database: string) =>
			`CREATE TABLE ${database}.keywordAnalysisResponses_new
			(
				taskId UUID,
				createdAt DateTime DEFAULT now(),
				keyword String,
				position UInt8,
				domain String,
				url String,
				type String,
				title String,
				description String
			)
			ENGINE = MergeTree
			ORDER BY (createdAt)`,
	},
	{
		name: "Copy data from keywordAnalysisResponses to new table",
		query: (database: string) =>
			`INSERT INTO ${database}.keywordAnalysisResponses_new
			SELECT taskId, createdAt, keyword, position, domain, url, type, title, description
			FROM ${database}.keywordAnalysisResponses`,
	},
	{
		name: "Drop old keywordAnalysisResponses table",
		query: (database: string) => `DROP TABLE ${database}.keywordAnalysisResponses`,
	},
	{
		name: "Rename keywordAnalysisResponses_new to keywordAnalysisResponses",
		query: (database: string) =>
			`RENAME TABLE ${database}.keywordAnalysisResponses_new TO ${database}.keywordAnalysisResponses`,
	},
	{
		name: "Drop table test",
		query: (database: string) => `DROP TABLE ${database}.test`,
	},
	{
		name: "Create keywordAnalysisResponses_new2 table with keywordAnalysisId",
		query: (database: string) =>
			`CREATE TABLE ${database}.keywordAnalysisResponses_new2
			(
				keywordAnalysisId LowCardinality(String),
				taskId UUID,
				createdAt DateTime DEFAULT now(),
				keyword String,
				position UInt8,
				domain String,
				url String,
				type String,
				title String,
				description String
			)
			ENGINE = MergeTree
			ORDER BY (keywordAnalysisId, createdAt)`,
	},
	{
		name: "Copy data from keywordAnalysisResponses to new2 table",
		query: (database: string) =>
			`INSERT INTO ${database}.keywordAnalysisResponses_new2
			SELECT '', taskId, createdAt, keyword, position, domain, url, type, title, description
			FROM ${database}.keywordAnalysisResponses`,
	},
	{
		name: "Drop keywordAnalysisResponses table for new2",
		query: (database: string) => `DROP TABLE ${database}.keywordAnalysisResponses`,
	},
	{
		name: "Rename keywordAnalysisResponses_new2 to keywordAnalysisResponses",
		query: (database: string) =>
			`RENAME TABLE ${database}.keywordAnalysisResponses_new2 TO ${database}.keywordAnalysisResponses`,
	},
	{
		name: "Create keywordAnalysisResponses_new3 table with analysisId",
		query: (database: string) =>
			`CREATE TABLE ${database}.keywordAnalysisResponses_new3
			(
				analysisId LowCardinality(String),
				taskId UUID,
				createdAt DateTime DEFAULT now(),
				keyword String,
				position UInt8,
				domain String,
				url String,
				type String,
				title String,
				description String
			)
			ENGINE = MergeTree
			ORDER BY (analysisId, createdAt)`,
	},
	{
		name: "Copy data from keywordAnalysisResponses to new3 table",
		query: (database: string) =>
			`INSERT INTO ${database}.keywordAnalysisResponses_new3
			SELECT keywordAnalysisId, taskId, createdAt, keyword, position, domain, url, type, title, description
			FROM ${database}.keywordAnalysisResponses`,
	},
	{
		name: "Drop keywordAnalysisResponses table for new3",
		query: (database: string) => `DROP TABLE ${database}.keywordAnalysisResponses`,
	},
	{
		name: "Rename keywordAnalysisResponses_new3 to keywordAnalysisResponses",
		query: (database: string) =>
			`RENAME TABLE ${database}.keywordAnalysisResponses_new3 TO ${database}.keywordAnalysisResponses`,
	},
	{
		name: "Remove projectId column for keywordAnalysisTasks",
		query: (database: string) =>
			`ALTER TABLE ${database}.keywordAnalysisTasks DROP COLUMN projectId`,
	},
	{
		name: "Remove batchIndex column for keywordAnalysisTasks",
		query: (database: string) =>
			`ALTER TABLE ${database}.keywordAnalysisTasks DROP COLUMN batchIndex`,
	},
	{
		name: "Remove duplicate IDs from keywordAnalysis table",
		query: (database: string) => [
			`-- For each duplicate ID, keep the earliest record and delete the rest`,
			`ALTER TABLE ${database}.keywordAnalysis DELETE WHERE (id, createdAt) NOT IN (SELECT id, min(createdAt) FROM ${database}.keywordAnalysis GROUP BY id)`,
		],
	},
	{
		name: "Fix keywordAnalysis table schema to use id as primary key",
		query: (database: string) => [
			`-- Create new table with correct schema (id as primary key)`,
			`CREATE TABLE ${database}.keywordAnalysis_new (id UUID, createdAt DateTime DEFAULT now(), projectId String, setId UUID, status String, error String DEFAULT '') ENGINE = MergeTree ORDER BY id`,

			`-- Copy data from old table to new table`,
			`INSERT INTO ${database}.keywordAnalysis_new SELECT id, createdAt, projectId, setId, status, error FROM ${database}.keywordAnalysis`,

			`-- Drop old table`,
			`DROP TABLE ${database}.keywordAnalysis`,

			`-- Rename new table to original name`,
			`RENAME TABLE ${database}.keywordAnalysis_new TO ${database}.keywordAnalysis`,
		],
	},
	{
		name: "Properly deduplicate keywordAnalysis table keeping earliest records",
		query: (database: string) => [
			`-- Create temp table with deduplicated data`,
			`CREATE TABLE ${database}.keywordAnalysis_dedup (id UUID, createdAt DateTime DEFAULT now(), projectId String, setId UUID, status String, error String DEFAULT '') ENGINE = ReplacingMergeTree(createdAt) ORDER BY id`,

			`-- Insert only the earliest record for each id`,
			`INSERT INTO ${database}.keywordAnalysis_dedup SELECT id, createdAt, projectId, setId, status, error FROM ${database}.keywordAnalysis WHERE (id, createdAt) IN (SELECT id, min(createdAt) as createdAt FROM ${database}.keywordAnalysis GROUP BY id)`,

			`-- Drop table with duplicates`,
			`DROP TABLE ${database}.keywordAnalysis`,

			`-- Rename deduplicated table`,
			`RENAME TABLE ${database}.keywordAnalysis_dedup TO ${database}.keywordAnalysis`,
		],
	},
	{
		name: "Create aggregatedKeywordAnalysisData table",
		query: (database: string) =>
			`CREATE TABLE IF NOT EXISTS ${database}.aggregatedKeywordAnalysisData
			(
				analysisId UUID,
				createdAt DateTime DEFAULT now(),
				domain String,
				volume UInt32,
				topThreeKeywordCount UInt32,
				topTenKeywordCount UInt32,
				positionnedKeywordCount UInt32,
				trend Nullable(Float64)
			)
			ENGINE = MergeTree
			ORDER BY (analysisId, createdAt)`,
	},
	{
		name: "Create keyword analysis task results table",
		query: (database: string) =>
			`CREATE TABLE IF NOT EXISTS ${database}.keywordAnalysisTaskResults
			(
				analysisId UUID,
				taskId UUID,
				status LowCardinality(String),
				itemCount UInt32 DEFAULT 0,
				error String DEFAULT '',
				createdAt DateTime64(3) DEFAULT now64(3),
				version UInt64 DEFAULT toUInt64(toUnixTimestamp64Milli(createdAt))
			)
			ENGINE = ReplacingMergeTree(version)
			ORDER BY (analysisId, taskId)`,
	},
	{
		name: "Add keyword analysis task lookup indexes",
		query: (database: string) => [
			`ALTER TABLE ${database}.keywordAnalysisResponses
			ADD INDEX taskId_bloom_filter taskId TYPE bloom_filter(0.01) GRANULARITY 1`,
			`ALTER TABLE ${database}.keywordAnalysisTasks
			ADD INDEX analysisId_bloom_filter analysisId TYPE bloom_filter(0.01) GRANULARITY 1`,
			`ALTER TABLE ${database}.keywordAnalysisTasks
			ADD INDEX taskId_bloom_filter id TYPE bloom_filter(0.01) GRANULARITY 1`,
		],
	},
	{
		name: "Materialize keyword analysis task lookup indexes",
		query: (database: string) => [
			`ALTER TABLE ${database}.keywordAnalysisResponses MATERIALIZE INDEX taskId_bloom_filter`,
			`ALTER TABLE ${database}.keywordAnalysisTasks MATERIALIZE INDEX analysisId_bloom_filter`,
			`ALTER TABLE ${database}.keywordAnalysisTasks MATERIALIZE INDEX taskId_bloom_filter`,
		],
	},
];

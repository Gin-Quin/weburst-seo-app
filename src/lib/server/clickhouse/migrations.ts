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
}

export type ClickhouseMigration = {
	name: string;
	query: (database: string) => string;
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
];

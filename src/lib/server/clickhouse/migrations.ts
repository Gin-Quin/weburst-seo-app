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
];

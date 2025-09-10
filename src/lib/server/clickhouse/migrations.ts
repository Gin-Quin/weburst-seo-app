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
];

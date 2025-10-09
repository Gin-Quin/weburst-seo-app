import type { Row } from "@clickhouse/client";

export type ClickHouseColumn = "string" | "number" | "boolean";

export type ClickhouseRow<Columns extends Record<string, ClickHouseColumn>> = {
	[Key in keyof Columns]: Columns[Key] extends "string"
		? string
		: Columns[Key] extends "number"
			? number
			: boolean;
};

export function parseClickhouseCsvRows<Columns extends Record<string, ClickHouseColumn>>(
	rows: Array<string | Row<unknown, "CSV">>,
	columns: Columns,
): Array<ClickhouseRow<Columns>> {
	const entries = Object.entries(columns);
	return rows.map((row) => parseClickhouseCsvRow(row, columns, entries));
}

export function parseClickhouseCsvRow<Columns extends Record<string, ClickHouseColumn>>(
	row: string | Row<unknown, "CSV">,
	columns: Columns,
	entries = Object.entries(columns),
): ClickhouseRow<Columns> {
	let offset = 0;
	const text = typeof row === "string" ? row : row.text;

	const skipSpaces = () => {
		while (text[offset] === " ") offset += 1;
	};

	const untilCommaOrEnd = () => {
		const start = offset;
		while (text[offset] !== "," && offset < text.length) offset += 1;
		return text.slice(start, offset);
	};

	const data: any = {};

	for (const [name, type] of entries) {
		skipSpaces();

		switch (type) {
			case "string": {
				if (text[offset] !== '"') {
					throw new Error(
						`Expected string value to start with '"' at offset ${offset} of row '${row}'`,
					);
				}
				offset += 1;
				const start = offset;

				while (offset < text.length) {
					if (text[offset] === '"') {
						offset += 1;
						if (text[offset] !== '"') break;
					}
					offset += 1;
				}

				if (text[offset - 1] !== '"') {
					throw new Error(
						`Expected string value to end with '"' at offset ${offset} of row '${row}'`,
					);
				}

				data[name] = text.slice(start, offset - 1);
				offset += 1;
				break;
			}

			case "number": {
				const content = untilCommaOrEnd();
				data[name] = parseFloat(content);
				offset += 1;
				break;
			}

			case "boolean": {
				const content = untilCommaOrEnd();
				data[name] = content === "true";
				offset += 1;
				break;
			}
		}
	}

	return data;
}

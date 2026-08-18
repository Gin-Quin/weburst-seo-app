import { describe, expect, test } from "bun:test";
import type { DataForSeo } from "./DataForSeo";
import { getReadySerpTasks } from "./getReadySerpTasks";

describe("getReadySerpTasks", () => {
	test("returns nested completed tasks instead of the response task", () => {
		const response = {
			tasks: [
				{
					id: "outer-tasks-ready-request-id",
					result: [
						{
							id: "completed-serp-task-id",
							se: "google",
							se_type: "organic",
							date_posted: "2026-08-11 14:37:00 +00:00",
							tag: "",
							endpoint_regular: "/v3/serp/google/organic/task_get/regular/completed-serp-task-id",
							endpoint_advanced: null,
							endpoint_html: null,
						},
					],
				},
			],
		} as unknown as DataForSeo.Serp.TaskReadyResponse;

		expect(getReadySerpTasks(response).map(({ id }) => id)).toEqual(["completed-serp-task-id"]);
	});

	test("ignores response tasks without results", () => {
		const response = {
			tasks: [{ id: "outer-tasks-ready-request-id", result: null }],
		} as unknown as DataForSeo.Serp.TaskReadyResponse;

		expect(getReadySerpTasks(response)).toEqual([]);
	});
});

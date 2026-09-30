import type { DataForSeo } from "./DataForSeo";

export function getKeywordTaskFailure(
	task: Pick<DataForSeo.Serp.Task, "status_code" | "status_message" | "result">,
): string | undefined {
	if (task.status_code !== 20000) return `${task.status_code}: ${task.status_message}`;
	if (task.result == null) return "Task completed without result data";
	return undefined;
}

export function getAnalysisFailureLog({
	analysisId,
	projectId,
	setId,
	task,
	response,
}: {
	analysisId: string;
	projectId?: string;
	setId?: string;
	task: DataForSeo.Serp.Task;
	response: DataForSeo.Serp.Response;
}) {
	return {
		event: "keyword-analysis-task-rejected",
		timestamp: new Date().toISOString(),
		analysisId,
		projectId,
		setId,
		taskId: task.id,
		error: getKeywordTaskFailure(task),
		provider: {
			version: response.version,
			statusCode: response.status_code,
			statusMessage: response.status_message,
			time: response.time,
			cost: response.cost,
			tasksCount: response.tasks_count,
			tasksError: response.tasks_error,
		},
		task: {
			statusCode: task.status_code,
			statusMessage: task.status_message,
			time: task.time,
			cost: task.cost,
			path: task.path,
			resultCount: task.result_count,
		},
		// Explicit fields exclude credentials and potentially signed callback URLs.
		request: {
			keyword: task.data?.keyword,
			locationCode: task.data?.location_code,
			languageCode: task.data?.language_code,
			device: task.data?.device,
			os: task.data?.os,
			depth: task.data?.depth,
			priority: task.data?.priority,
			searchEngine: task.data?.se,
			searchType: task.data?.se_type,
		},
		results:
			task.result?.map((result) => ({
				keyword: result.keyword,
				datetime: result.datetime,
				searchEngineDomain: result.se_domain,
				searchResultsCount: result.se_results_count,
				reportedItemsCount: result.items_count,
				receivedItemsCount: result.items?.length ?? 0,
				itemTypes: result.item_types,
				ranks:
					result.items?.map(({ type, rank_group, rank_absolute }) => ({
						type,
						rank_group,
						rank_absolute,
					})) ?? [],
			})) ?? null,
	};
}

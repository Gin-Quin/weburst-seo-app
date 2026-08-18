import type { DataForSeo } from "./DataForSeo";

/** Extract completed SERP tasks from the tasks_ready response envelope. */
export function getReadySerpTasks(
	response: Pick<DataForSeo.Serp.TaskReadyResponse, "tasks">,
): DataForSeo.Serp.TaskReady[] {
	return response.tasks.flatMap((responseTask) => responseTask.result ?? []);
}

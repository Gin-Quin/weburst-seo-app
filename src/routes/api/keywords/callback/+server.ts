import type { DataForSeo } from "$lib/server/clickhouse/services/DataForSeo";
import { KeywordsService } from "$lib/server/clickhouse/services/keywords";
import { text } from "@sveltejs/kit";
import { gunzipSync } from "bun";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const encoded = await request.arrayBuffer();
	const decoded = gunzipSync(encoded);
	const json = new TextDecoder().decode(decoded);
	const data = JSON.parse(json) as DataForSeo.Serp.Response;

	const [firstTask] = data.tasks;

	if (!firstTask) {
		console.warn("No tasks found in the response");
		return text("OK — But no tasks found");
	}

	const analysisId = await KeywordsService.getAnalysisIdFromTaskId({
		taskId: firstTask.id,
	});

	if (!analysisId) {
		console.warn(`No analysis ID found for task ID ${firstTask.id}`);
		return text("OK — But no analysis found related to the task");
	}

	KeywordsService.saveKeywordAnalysisResult({
		analysisId,
		result: data,
	});

	return text("OK");
};

export const GET: RequestHandler = async ({ request }) => {
	return text("OK");
};

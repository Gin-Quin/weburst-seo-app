import type { DataForSeo } from "$lib/server/clickhouse/services/DataForSeo";
import { KeywordsService } from "$lib/server/clickhouse/services/keywords";
import { text } from "@sveltejs/kit";
import { gunzipSync } from "bun";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
	const startedAt = performance.now();
	const encoded = await request.arrayBuffer();
	const decoded = gunzipSync(encoded);
	const json = new TextDecoder().decode(decoded);
	const data = JSON.parse(json) as DataForSeo.Serp.Response;
	const parsedAt = performance.now();

	const [firstTask] = data.tasks ?? [];

	if (!firstTask) {
		console.warn("No tasks found in the response");
		return text("OK — But no tasks found");
	}

	for (let retries = 0; retries < 5; retries++) {
		const analysisId = await KeywordsService.getAnalysisIdFromTaskId({
			taskId: firstTask.id,
		});

		if (!analysisId) {
			await new Promise((resolve) => setTimeout(resolve, 500));
		} else {
			const foundAt = performance.now();
			await KeywordsService.saveKeywordAnalysisResult({
				analysisId,
				result: data,
			});

			// DataForSEO aborts a postback that takes longer than 10 seconds.
			const finishedAt = performance.now();
			console.log("[dataforseo-callback]", {
				taskId: firstTask.id,
				lookupAttempts: retries + 1,
				parseMs: Math.round(parsedAt - startedAt),
				lookupMs: Math.round(foundAt - parsedAt),
				saveMs: Math.round(finishedAt - foundAt),
				totalMs: Math.round(finishedAt - startedAt),
			});
			return text("OK");
		}
	}

	// A 2xx answer marks the postback as delivered, and the task would never be listed in
	// tasks_ready. Reject it so the ready-task poller collects it once its row exists.
	console.warn(`No analysis ID found for task ID ${firstTask.id}; rejecting the callback`);
	return text("Unknown task", { status: 503 });
};

export const GET: RequestHandler = async () => {
	return text("OK");
};

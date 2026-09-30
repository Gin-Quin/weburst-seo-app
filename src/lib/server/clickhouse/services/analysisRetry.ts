import type { DataForSeo } from "./DataForSeo";

export const MAX_KEYWORD_RETRIES = 2;
export const KEYWORD_RETRY_DELAY_MS = 30_000;
export const RETRY_SUBMISSION_TIMEOUT_MS = 120_000;

/** Persist only request fields needed for resubmission, never callback URLs or credentials. */
export function getRetryRequest(
	data: Pick<DataForSeo.Serp.Data, "keyword" | "location_code" | "language_code" | "device" | "os" | "depth" | "priority">,
	analysisId: string,
) {
	return {
		keyword: data.keyword,
		tag: analysisId,
		location_code: data.location_code,
		language_code: data.language_code,
		device: data.device,
		os: data.os,
		depth: data.depth,
		priority: data.priority,
	};
}

export function shouldRetryKeyword(statusCode: number, retryCount: number): boolean {
	return statusCode === 40106 && retryCount < MAX_KEYWORD_RETRIES;
}

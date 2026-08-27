import { env } from "$env/dynamic/private";

const SERPMANTICS_ORIGIN = "https://app.serpmantics.com";

export type SerpmanticsRange = { from: number; to: number };

export type SerpmanticsExpression = {
	expression: string;
	from?: number;
	to?: number;
	isStatisticallyDifferent?: boolean;
	serpResultsPresence?: Record<string, number>;
};

export type SerpmanticsGuide = {
	id: string;
	query: string;
	lang: string;
	source?: string;
	createdAt?: string;
	updatedAt?: string;
	guide?: {
		structure?: Record<string, SerpmanticsRange>;
		add?: SerpmanticsExpression[];
		avoid?: SerpmanticsExpression[];
	};
	scoreGuidelines?: {
		expressions?: Record<string, number>;
		stats?: Record<string, unknown>;
	};
	topSERPResultsDetails?: Array<Record<string, unknown>>;
	isReady?: boolean;
	progressStatus?: {
		isReady?: boolean;
		pct?: number;
		step?: string;
		terminal?: boolean;
		reason?: string;
		message?: string;
	};
};

export type SerpmanticsContentAnalysis = {
	structure: {
		length: number;
		headings: number;
		paragraphs: number;
		images: number;
		videos: number;
		links: number;
		tables: number;
		lists: number;
	};
	expressions: Record<string, number>;
	score: number;
};

type GuideCreationResponse = {
	success: boolean;
	guides?: Array<{ id: string }>;
	guidesFailed?: unknown[];
	error?: string;
};

type GuideResponse = {
	success: boolean;
	status?: "failed";
	error?: string;
	creationFailed?: boolean;
	guide?: SerpmanticsGuide;
};

type ScoreResponse = {
	success: boolean;
	contentAnalysis?: SerpmanticsContentAnalysis;
	error?: string;
};

export type SerpmanticsGuideState =
	| { state: "pending"; progress?: SerpmanticsGuide["progressStatus"] }
	| { state: "ready"; guide: SerpmanticsGuide }
	| { state: "failed"; error: string; guide?: SerpmanticsGuide };

export async function createSerpmanticsGuide(query: string): Promise<string> {
	const response = await request<GuideCreationResponse>("/api/v1/guides", {
		method: "POST",
		body: JSON.stringify({ queries: [query], lang: "fr-fr", source: "google" }),
	});
	const guideId = response.guides?.[0]?.id;
	if (!response.success || !guideId) {
		throw new Error(response.error ?? "SERPmantics n’a pas renvoyé de guide.");
	}
	return guideId;
}

export async function getSerpmanticsGuide(guideId: string): Promise<SerpmanticsGuideState> {
	const response = await rawRequest(`/api/v1/guide?id=${encodeURIComponent(guideId)}`, {
		method: "GET",
	});
	if (response.status === 202) {
		const payload = (await parseJson(response)) as GuideResponse;
		return { state: "pending", progress: payload.guide?.progressStatus };
	}
	const payload = (await parseJson(response)) as GuideResponse;
	if (!response.ok || payload.creationFailed || payload.status === "failed") {
		return {
			state: "failed",
			error: payload.error ?? `SERPmantics a répondu avec le statut ${response.status}.`,
			guide: payload.guide,
		};
	}
	if (!payload.success || !payload.guide) {
		return { state: "failed", error: payload.error ?? "Guide SERPmantics indisponible." };
	}
	return { state: "ready", guide: payload.guide };
}

export async function analyzeSerpmanticsContent(
	guideId: string,
	content: string,
): Promise<SerpmanticsContentAnalysis> {
	const response = await request<ScoreResponse>("/api/v1/score", {
		method: "POST",
		body: JSON.stringify({ guideId, content, saveToGuide: true }),
	});
	if (!response.success || !response.contentAnalysis) {
		throw new Error(response.error ?? "Analyse SERPmantics indisponible.");
	}
	return response.contentAnalysis;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
	const response = await rawRequest(path, init);
	const payload = (await parseJson(response)) as T & { error?: string };
	if (!response.ok) {
		throw new Error(payload.error ?? `SERPmantics a répondu avec le statut ${response.status}.`);
	}
	return payload;
}

async function rawRequest(path: string, init: RequestInit): Promise<Response> {
	if (!env.SERPMANTICS_API_KEY) {
		throw new Error("SERPMANTICS_API_KEY n’est pas configurée.");
	}
	return fetch(`${SERPMANTICS_ORIGIN}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${env.SERPMANTICS_API_KEY}`,
			"Content-Type": "application/json",
			...init.headers,
		},
		signal: AbortSignal.timeout(45_000),
	});
}

async function parseJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return {};
	}
}

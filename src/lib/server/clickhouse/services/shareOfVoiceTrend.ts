import { extractHost } from "$lib/keywords/serpAnalytics";
import { DAY } from "$lib/timeUnits";

export const MINIMUM_TREND_REFERENCE_AGE = 30 * DAY;

type DatedAnalysis = {
	id: string;
	createdAt: string;
};

type ShareOfVoiceRow = {
	domain: string;
	volume: number;
	trend?: number;
};

export function selectTrendReferenceAnalysis<T extends DatedAnalysis>(
	analyses: ReadonlyArray<T>,
	currentAnalysisAt: string,
): T | undefined {
	const cutoff = new Date(currentAnalysisAt).getTime() - MINIMUM_TREND_REFERENCE_AGE;

	return analyses
		.filter((analysis) => new Date(analysis.createdAt).getTime() <= cutoff)
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

export function applyShareOfVoiceTrends<T extends ShareOfVoiceRow>(
	currentRows: ReadonlyArray<T>,
	currentTotalTraffic: number,
	referenceRows: ReadonlyArray<ShareOfVoiceRow> | undefined,
	referenceTotalTraffic: number,
): Array<T> {
	const referenceByDomain = new Map(
		referenceRows?.map((row) => [extractHost(row.domain), row]) ?? [],
	);

	return currentRows.map((row) => {
		const reference = referenceByDomain.get(extractHost(row.domain));
		const trend =
			reference && currentTotalTraffic > 0 && referenceTotalTraffic > 0
				? row.volume / currentTotalTraffic - reference.volume / referenceTotalTraffic
				: undefined;

		return { ...row, trend };
	});
}

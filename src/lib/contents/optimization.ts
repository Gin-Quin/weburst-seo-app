import type {
	SerpmanticsContentAnalysis,
	SerpmanticsGuide,
	SerpmanticsRange,
} from "$lib/server/serpmantics";

export type OptimizationState = "valid" | "add" | "remove";
export type OptimizationScoreTone = "bad" | "mid" | "good";

export type OptimizationContent = {
	html: string;
	text: string;
};

export type OptimizationMetrics = Omit<SerpmanticsContentAnalysis, "score">;

export function analyzeOptimizationMetrics(
	content: OptimizationContent,
	guide: SerpmanticsGuide | null,
): OptimizationMetrics {
	const words = tokenize(content.text);
	const expressions = Object.fromEntries(
		[...(guide?.guide?.add ?? []), ...(guide?.guide?.avoid ?? [])].map(({ expression }) => [
			expression,
			countExpression(words, expression),
		]),
	);

	return {
		structure: {
			length: words.length,
			headings: countTags(content.html, "h[1-6]"),
			paragraphs: countTags(content.html, "p"),
			images: countTags(content.html, "img"),
			videos: countTags(content.html, "video|iframe"),
			links: countTags(content.html, "a"),
			tables: countTags(content.html, "table"),
			lists: countTags(content.html, "ul|ol"),
		},
		expressions,
	};
}

export function getOptimizationState(
	value: number,
	range: SerpmanticsRange | undefined,
): OptimizationState {
	if (!range) return "valid";
	if (value < range.from) return "add";
	if (value > range.to) return "remove";
	return "valid";
}

export function getOptimizationScoreTone(score: number): OptimizationScoreTone {
	if (score < 25) return "bad";
	if (score < 50) return "mid";
	return "good";
}

export function getStructureMetrics(
	guide: SerpmanticsGuide | null,
	analysis: OptimizationMetrics | SerpmanticsContentAnalysis | null,
) {
	const structure = analysis?.structure;
	const ranges = guide?.guide?.structure;
	return [
		metric("Mots", structure?.length ?? 0, ranges?.length),
		metric("Titres", structure?.headings ?? 0, ranges?.headings),
		metric("Paragraphes", structure?.paragraphs ?? 0, ranges?.paragraphs),
		metric("Liens", structure?.links ?? 0, combineLinkRanges(ranges)),
		metric("Images", structure?.images ?? 0, ranges?.images),
		metric("Vidéos", structure?.videos ?? 0, ranges?.videos),
		metric("Tableaux", structure?.tables ?? 0, ranges?.tables),
		metric("Listes", structure?.lists ?? 0, ranges?.lists),
	];
}

function metric(label: string, value: number, range: SerpmanticsRange | undefined) {
	return { label, value, range, state: getOptimizationState(value, range) };
}

function combineLinkRanges(
	ranges: Record<string, SerpmanticsRange> | undefined,
): SerpmanticsRange | undefined {
	const internal = ranges?.linksInternal;
	const external = ranges?.linksExternal;
	if (!internal && !external) return undefined;
	return {
		from: (internal?.from ?? 0) + (external?.from ?? 0),
		to: (internal?.to ?? 0) + (external?.to ?? 0),
	};
}

function tokenize(value: string): string[] {
	return (
		value
			.normalize("NFD")
			.replace(/\p{Mark}/gu, "")
			.toLocaleLowerCase("fr-FR")
			.match(/[\p{Letter}\p{Number}]+/gu) ?? []
	);
}

function countExpression(words: string[], expression: string): number {
	const expressionWords = tokenize(expression);
	if (expressionWords.length === 0 || expressionWords.length > words.length) return 0;

	let occurrences = 0;
	for (let index = 0; index <= words.length - expressionWords.length; index += 1) {
		if (expressionWords.every((word, offset) => words[index + offset] === word)) {
			occurrences += 1;
		}
	}
	return occurrences;
}

function countTags(html: string, tagPattern: string): number {
	return html.match(new RegExp(`<(?:${tagPattern})(?:\\s|/?>)`, "gi"))?.length ?? 0;
}

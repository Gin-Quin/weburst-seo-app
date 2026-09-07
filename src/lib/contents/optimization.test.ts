import { expect, test } from "bun:test";
import {
	analyzeOptimizationMetrics,
	getOptimizationScoreTone,
	getOptimizationState,
} from "./optimization";
import type { SerpmanticsGuide } from "$lib/server/serpmantics";

test("getOptimizationState compares the value with the recommendation", () => {
	expect(getOptimizationState(2, { from: 3, to: 5 })).toBe("add");
	expect(getOptimizationState(4, { from: 3, to: 5 })).toBe("valid");
	expect(getOptimizationState(7, { from: 3, to: 5 })).toBe("remove");
});

test("getOptimizationScoreTone applies the optimization score thresholds", () => {
	expect(getOptimizationScoreTone(0)).toBe("bad");
	expect(getOptimizationScoreTone(24)).toBe("bad");
	expect(getOptimizationScoreTone(25)).toBe("mid");
	expect(getOptimizationScoreTone(49)).toBe("mid");
	expect(getOptimizationScoreTone(50)).toBe("good");
	expect(getOptimizationScoreTone(120)).toBe("good");
});

test("analyzeOptimizationMetrics updates structure and occurrences locally", () => {
	const guide = {
		guide: {
			add: [
				{ expression: "porte de garage", from: 2, to: 3 },
				{ expression: "sécurité", from: 1, to: 2 },
			],
			avoid: [{ expression: "fragile" }],
		},
	} as SerpmanticsGuide;

	expect(
		analyzeOptimizationMetrics(
			{
				html: '<h1>Porte de garage</h1><p>Une porte de garage sûre.</p><a href="/">Lien</a><ul><li>Solide</li></ul>',
				text: "Porte de garage\n\nUne porte de garage sûre. Lien Solide",
			},
			guide,
		),
	).toEqual({
		structure: {
			length: 10,
			headings: 1,
			paragraphs: 1,
			images: 0,
			videos: 0,
			links: 1,
			tables: 0,
			lists: 1,
		},
		expressions: {
			"porte de garage": 2,
			sécurité: 0,
			fragile: 0,
		},
	});
});

test("analyzeOptimizationMetrics matches accents and punctuation as word boundaries", () => {
	const guide = {
		guide: { add: [{ expression: "sécurité", from: 2, to: 3 }] },
	} as SerpmanticsGuide;

	const result = analyzeOptimizationMetrics(
		{ html: "<p>Sécurité, securite et sécurités.</p>", text: "Sécurité, securite et sécurités." },
		guide,
	);

	expect(result.expressions.sécurité).toBe(2);
});

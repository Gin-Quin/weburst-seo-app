import { expect, test } from "bun:test";
import {
	contentHtmlToText,
	convertAsciiTablesInHtml,
	createInitialArticleHtml,
	sanitizeContentHtml,
} from "./articleHtml";

test("sanitizeContentHtml keeps editor markup and removes scripts", () => {
	expect(
		sanitizeContentHtml('<h2>Title</h2><script>alert(1)</script><a href="javascript:bad">link</a>'),
	).toBe('<h2>Title</h2><a rel="noopener noreferrer">link</a>');
});

test("contentHtmlToText extracts plain text", () => {
	expect(contentHtmlToText("<h1>Hello</h1><p>World</p>")).toBe("Hello\nWorld");
});

test("createInitialArticleHtml escapes the title", () => {
	expect(createInitialArticleHtml("A & <B>")).toBe("<h1>A &amp; &lt;B&gt;</h1><p></p>");
});

test("convertAsciiTablesInHtml turns fenced ASCII comparisons into semantic tables", () => {
	const html = `<pre><code>+----------------+----------+
| COMPARATIF DES PORTES    |
+----------------+----------+
| Type           | Isolation|
+----------------+----------+
| Sectionnelle   | Élevée   |
| Battante       | Modérée  |
+----------------+----------+</code></pre>`;

	expect(convertAsciiTablesInHtml(html)).toBe(
		"<p><strong>COMPARATIF DES PORTES</strong></p><table><thead><tr><th>Type</th><th>Isolation</th></tr></thead><tbody><tr><td>Sectionnelle</td><td>Élevée</td></tr><tr><td>Battante</td><td>Modérée</td></tr></tbody></table>",
	);
});

test("convertAsciiTablesInHtml leaves non-tabular diagrams as code", () => {
	const diagram = "<pre><code>[ Télécommande ]\n       |\n       v\n[ Moteur ]</code></pre>";
	expect(convertAsciiTablesInHtml(diagram)).toBe(diagram);
});

test("sanitizeContentHtml preserves safe table markup", () => {
	expect(
		sanitizeContentHtml(
			'<table onclick="bad()"><tbody><tr><th colspan="2">Titre</th></tr><tr><td>Cellule</td></tr></tbody></table>',
		),
	).toBe(
		'<table><tbody><tr><th colspan="2">Titre</th></tr><tr><td>Cellule</td></tr></tbody></table>',
	);
});

test("sanitizeContentHtml resolves imported links and images against their source page", () => {
	expect(
		sanitizeContentHtml('<p><a href="../contact">Contact</a></p><img src="/photo.jpg">', {
			baseUrl: "https://example.com/blog/article",
		}),
	).toBe(
		'<p><a href="https://example.com/contact" rel="noopener noreferrer">Contact</a></p><img src="https://example.com/photo.jpg" />',
	);
});

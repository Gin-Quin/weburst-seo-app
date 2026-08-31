import { describe, expect, test } from "bun:test";
import {
	ArticleImportError,
	importArticleFromUrl,
	isPrivateIpAddress,
	normalizeArticleUrl,
	preparePageHtmlForExtraction,
} from "./importArticle";

describe("importArticleFromUrl", () => {
	test("prepares the page for Gemini and sanitizes the extracted article", async () => {
		let htmlSentToGemini = "";
		const imported = await importArticleFromUrl("https://example.com/source", {
			downloadPage: async () => ({
				html: "<html><body><script>alert(1)</script><article><h1>Original</h1></article></body></html>",
				finalUrl: "https://example.com/blog/article",
			}),
			extractArticle: async (pageHtml) => {
				htmlSentToGemini = pageHtml;
				return '<article class="post"><h1>Original</h1><p onclick="bad()">Texte <a href="../contact">utile</a>.</p><img src="/cover.jpg" alt="Couverture"><script>bad()</script></article>';
			},
		});

		expect(htmlSentToGemini).toContain("<article><h1>Original</h1></article>");
		expect(htmlSentToGemini).not.toContain("alert(1)");
		expect(imported).toBe(
			'<h1>Original</h1><p>Texte <a href="https://example.com/contact" rel="noopener noreferrer">utile</a>.</p><img src="https://example.com/cover.jpg" alt="Couverture" />',
		);
	});

	test("rejects an empty extraction", async () => {
		expect(
			importArticleFromUrl("https://example.com", {
				downloadPage: async () => ({ html: "<main>Page</main>", finalUrl: "https://example.com" }),
				extractArticle: async () => "<script>nothing()</script>",
			}),
		).rejects.toThrow("Gemini n’a pas trouvé de contenu d’article exploitable");
	});
});

describe("article URL safety", () => {
	test("accepts only HTTP(S) URLs without credentials", () => {
		expect(normalizeArticleUrl(" https://example.com/post#comments ").toString()).toBe(
			"https://example.com/post",
		);
		expect(() => normalizeArticleUrl("file:///etc/passwd")).toThrow(ArticleImportError);
		expect(() => normalizeArticleUrl("https://admin:secret@example.com")).toThrow(
			ArticleImportError,
		);
	});

	test("recognizes local and private IP addresses", () => {
		for (const address of [
			"127.0.0.1",
			"10.0.0.2",
			"172.20.0.1",
			"192.168.1.1",
			"169.254.169.254",
			"::1",
			"fd00::1",
			"::ffff:127.0.0.1",
		]) {
			expect(isPrivateIpAddress(address)).toBe(true);
		}
		expect(isPrivateIpAddress("8.8.8.8")).toBe(false);
		expect(isPrivateIpAddress("2606:4700:4700::1111")).toBe(false);
	});
});

test("preparePageHtmlForExtraction removes executable and irrelevant markup", () => {
	const prepared = preparePageHtmlForExtraction(
		'<style>.hidden{display:none}</style><main><h1>Titre</h1><p style="color:red">Texte</p><form><input value="secret"></form></main>',
	);
	expect(prepared).toBe("<main><h1>Titre</h1><p>Texte</p></main>");
});

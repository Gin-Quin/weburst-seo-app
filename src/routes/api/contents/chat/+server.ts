import { getGoogleGenerativeAI, GOOGLE_CHAT_MODEL } from "$lib/server/ai/google";
import { requireProjectAccess } from "$lib/server/auth/authorization";
import {
	getContentById,
	refreshContentOptimization,
	saveContentChatMessages,
	updateContentBrief,
} from "$lib/server/contents";
import {
	convertToModelMessages,
	simulateStreamingMiddleware,
	stepCountIs,
	streamText,
	tool,
	type UIMessage,
	validateUIMessages,
	wrapLanguageModel,
} from "ai";
import { z } from "zod";
import type { RequestHandler } from "./$types";
import { getRequestUser } from "../../utilities";

type ChatRequest = {
	projectId?: string;
	contentId?: string;
	messages?: UIMessage<{ createdAt?: number }>[];
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as ChatRequest;
		if (!body.projectId || !body.contentId || !Array.isArray(body.messages)) {
			return new Response("Requête de chat invalide.", { status: 400 });
		}
		await requireProjectAccess(await getRequestUser(), body.projectId, "manage");

		const content = await getContentById(body.contentId, body.projectId);
		const google = getGoogleGenerativeAI();
		if (!google) {
			return new Response("GEMINI_API_KEY n’est pas configurée.", { status: 503 });
		}

		const tools = {
			getArticleContext: tool({
				description:
					"Relire le contenu, le brief et les recommandations SEO les plus récents avant de répondre ou de modifier l’article.",
				inputSchema: z.object({}),
				execute: async () => getContentById(body.contentId!, body.projectId!),
			}),
			write_article: tool({
				description:
					"Proposer une nouvelle version complète de l’article en Markdown éditable, sans diagramme ni tableau ASCII. Le frontend affichera les différences et demandera à l’utilisateur d’accepter ou d’annuler avant toute modification.",
				inputSchema: z.object({
					content: z.string().describe("Le contenu Markdown complet de la nouvelle version"),
					summary: z.string().describe("Un bref résumé des modifications proposées"),
				}),
				execute: async ({ summary }) => ({ status: "proposal_ready" as const, summary }),
			}),
			updateBrief: tool({
				description:
					"Mettre à jour le brief éditorial lorsque l’utilisateur le demande explicitement.",
				inputSchema: z.object({ brief: z.string() }),
				execute: async ({ brief }) => {
					const updated = await updateContentBrief({
						id: body.contentId!,
						projectId: body.projectId!,
						brief,
					});
					return { success: true, brief: updated.brief, updatedAt: updated.updatedAt };
				},
			}),
			refreshSeoAnalysis: tool({
				description:
					"Relancer l’analyse SERPmantics du texte courant et obtenir le score et les occurrences actualisés.",
				inputSchema: z.object({}),
				execute: async () => {
					const updated = await refreshContentOptimization(body.contentId!, body.projectId!);
					return {
						status: updated.serpmanticsStatus,
						error: updated.serpmanticsError,
						score: updated.score,
						analysis: updated.serpmanticsAnalysis,
					};
				},
			}),
		};

		const messages = await validateUIMessages({ messages: body.messages });
		const result = streamText({
			// Article drafts are long JSON tool arguments. Wait for Gemini's complete
			// response so an interrupted provider stream cannot expose partial JSON.
			model: wrapLanguageModel({
				model: google(GOOGLE_CHAT_MODEL),
				middleware: simulateStreamingMiddleware(),
			}),
			instructions: buildSystemPrompt(content),
			messages: await convertToModelMessages(messages, { tools }),
			tools,
			stopWhen: stepCountIs(6),
			temperature: 0.4,
		});

		return result.toUIMessageStreamResponse({
			originalMessages: messages,
			messageMetadata: ({ part }) =>
				part.type === "start" ? { createdAt: Date.now() } : undefined,
			onEnd: async ({ messages: completedMessages }) => {
				await saveContentChatMessages(body.contentId!, body.projectId!, completedMessages);
			},
			onError: (error) => {
				console.error("Gemini content chat error", error);
				return "Le chat n’a pas pu terminer sa réponse.";
			},
		});
	} catch (error) {
		console.error("Content chat request error", error);
		return new Response(error instanceof Error ? error.message : "Erreur de chat.", {
			status: 500,
		});
	}
};

function buildSystemPrompt(content: Awaited<ReturnType<typeof getContentById>>): string {
	return `Tu es un assistant éditorial SEO francophone intégré à WeBurst.
Tu aides l’utilisateur à écrire et optimiser l’article courant. Réponds en Markdown clair et concis.
N’invente jamais de données issues de SERPmantics. Appuie tes conseils sur le contexte ci-dessous.
Avant une modification importante, relis le contexte avec getArticleContext si une conversation précédente a pu le changer.
Quand l’utilisateur te demande d’appliquer, réécrire, créer ou optimiser le texte, utilise write_article au lieu de seulement proposer le texte dans le chat.
Transmets toujours l’article complet dans le champ content, en Markdown valide. Pour toute donnée tabulaire ou comparaison, utilise impérativement la syntaxe de tableau Markdown avec en-têtes ; n’utilise jamais de tableau ASCII dans un bloc de code. Ne produis jamais de diagramme, organigramme ou autre dessin ASCII. Exprime les relations et les enchaînements avec des titres, des listes ordonnées ou à puces et du texte explicatif afin que le résultat reste lisible, responsive et éditable. Préserve la structure, les images et les informations utiles, et n’ajoute pas de faux faits. L’utilisateur validera la proposition avant qu’elle soit appliquée.

CONTEXTE COMPLET ACTUEL
Titre : ${content.title}
URL existante : ${content.existingUrl ?? "aucune"}
Cluster : ${content.cluster ?? "aucun"}
Brief :
${content.brief || "(vide)"}

ARTICLE HTML :
${content.contentHtml}

ARTICLE TEXTE :
${content.contentText}

DERNIER GUIDE SERPMANTICS :
${JSON.stringify(content.serpmanticsGuide ?? null)}

DERNIÈRE ANALYSE SERPMANTICS :
${JSON.stringify(content.serpmanticsAnalysis ?? null)}`;
}

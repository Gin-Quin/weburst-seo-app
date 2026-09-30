import { buildContentChatSystemPrompt } from "$lib/server/ai/contentChatPrompt";
import { getClientWritingExamples, formatWritingExamples } from "$lib/server/contents/writingExamples";
import { getProjectTypology } from "$lib/server/contents/typologies";
import { getGoogleGenerativeAI, GOOGLE_CHAT_MODEL } from "$lib/server/ai/google";
import {
	appendClientChatMemory,
	appendContentChatMemory,
	loadClientChatContext,
} from "$lib/server/ai/chatMemory";
import { MAX_MEMORY_ENTRY_LENGTH } from "$lib/contents/chatMemory";
import { protectToolInputStream } from "$lib/server/ai/protectToolInputStream";
import { requireProjectAccess } from "$lib/server/auth/authorization";
import {
	getContentById,
	refreshContentOptimization,
	saveContentChatMessages,
	updateContentBrief,
} from "$lib/server/contents";
import { db } from "$lib/server/db";
import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	stepCountIs,
	streamText,
	tool,
	type UIMessage,
	validateUIMessages,
} from "ai";
import { z } from "zod";
import type { RequestHandler } from "./$types";
import { getRequestUser } from "../../utilities";

type ChatMessage = UIMessage<{ createdAt?: number }>;

type ChatRequest = {
	projectId?: string;
	contentId?: string;
	messages?: ChatMessage[];
};

const WriteArticleInput = z.object({
	content: z.string().describe("Le contenu Markdown complet de la nouvelle version"),
	summary: z.string().describe("Un bref résumé des modifications proposées"),
});

export const POST: RequestHandler = async ({ request, platform }) => {
	// Gemini can take longer than Bun's default 10-second idle timeout before
	// producing the first byte. This endpoint is an SSE stream, so keep the
	// underlying Bun request alive while the provider and tools are working.
	platform?.server.timeout(platform.request, 0);

	try {
		const body = (await request.json()) as ChatRequest;
		if (!body.projectId || !body.contentId || !Array.isArray(body.messages)) {
			return new Response("Requête de chat invalide.", { status: 400 });
		}
		const user = await getRequestUser();
		const project = await requireProjectAccess(user, body.projectId, "manage");
		if (!user) throw new Error("Unauthorized");

		const content = await getContentById(body.contentId, body.projectId);
		const clientContext = await loadClientChatContext(db, project.clientId);
		const typology = await getProjectTypology(db, body.projectId!, content.typologyId);
		const writingExamples = await getClientWritingExamples(db, { projectId: body.projectId, contentId: content.id, typologyId: content.typologyId });
		const google = getGoogleGenerativeAI();
		if (!google) return new Response("GEMINI_API_KEY n’est pas configurée.", { status: 503 });

		const tools = {
			google_search: google.tools.googleSearch({
				searchTypes: { webSearch: {} },
			}),
			getArticleContext: tool({
				description:
					"Relire le contenu, le brief, la typologie éditoriale, le contexte client, les mémoires et les recommandations SEO les plus récents avant de répondre ou de modifier l’article.",
				inputSchema: z.object({}),
				execute: async () => {
					const latest = await getContentById(body.contentId!, body.projectId!);
					const latestClientContext = await loadClientChatContext(db, project.clientId);
					return {
						title: latest.title,
						existingUrl: latest.existingUrl,
						cluster: latest.cluster,
						brief: latest.brief,
						typology: await getProjectTypology(db, body.projectId!, latest.typologyId),
						writingExamples: await getClientWritingExamples(db, { projectId: body.projectId!, contentId: latest.id, typologyId: latest.typologyId }),
						contentMemory: latest.chatMemory,
						clientContext: latestClientContext.context,
						clientMemory: latestClientContext.memory,
						contentHtml: latest.contentHtml,
						contentText: latest.contentText,
						optimizationStatus: latest.serpmanticsStatus,
						optimizationError: latest.serpmanticsError,
						optimizationGuide: latest.serpmanticsGuide,
						optimizationAnalysis: latest.serpmanticsAnalysis,
					};
				},
			}),
			save_memory_content: tool({
				description:
					"Mémoriser de façon proactive une information durable propre à cet article et utile dans de futures conversations sur ce contenu : audience ou angle spécifique, décision éditoriale, contrainte, préférence ou fait fourni par l’utilisateur. Ne pas enregistrer une consigne temporaire, une information déjà mémorisée ou une connaissance générale trouvée sur le web.",
				inputSchema: z.object({
					information: z
						.string()
						.trim()
						.min(1)
						.max(MAX_MEMORY_ENTRY_LENGTH)
						.describe("Une information autonome, concise et compréhensible hors conversation"),
				}),
				execute: async ({ information }) => ({
					success: true,
					memory: await appendContentChatMemory(db, {
						contentId: body.contentId!,
						projectId: body.projectId!,
						information,
					}),
				}),
			}),
			save_memory_client: tool({
				description:
					"Mémoriser de façon proactive une information durable concernant le client dans son ensemble et utile pour plusieurs contenus : activité, offre, audience générale, ton de marque, terminologie, positionnement ou règle éditoriale transverse. Ne pas y enregistrer une information propre au seul article courant, une consigne temporaire ou une connaissance générale trouvée sur le web.",
				inputSchema: z.object({
					information: z
						.string()
						.trim()
						.min(1)
						.max(MAX_MEMORY_ENTRY_LENGTH)
						.describe("Une information autonome, concise et compréhensible hors conversation"),
				}),
				execute: async ({ information }) => {
					if (!project.clientId) throw new Error("Aucun client n’est associé à ce projet.");
					return {
						success: true,
						memory: await appendClientChatMemory(db, {
							clientId: project.clientId,
							information,
						}),
					};
				},
			}),
			write_article: tool({
				description:
					"Proposer une nouvelle version complète de l’article en Markdown éditable, sans diagramme ni tableau ASCII. Le frontend affichera les différences et demandera à l’utilisateur d’accepter ou d’annuler avant toute modification.",
				inputSchema: WriteArticleInput,
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
					"Relancer l’analyse SEO du texte courant et obtenir le score et les occurrences actualisés.",
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

		const messages = await validateUIMessages<ChatMessage>({ messages: body.messages });
		const modelMessages = await convertToModelMessages(messages, {
			tools,
			ignoreIncompleteToolCalls: true,
		});

		const result = streamText({
			model: google(GOOGLE_CHAT_MODEL),
			instructions: buildContentChatSystemPrompt(content, clientContext, typology, formatWritingExamples(writingExamples)),
			// A provider or network interruption can leave a partial tool call in the
			// client history. Ignore it so the next user attempt can still be sent.
			messages: modelMessages,
			tools,
			stopWhen: stepCountIs(6),
			temperature: 0.4,
		});

		const uiStream = createUIMessageStream<ChatMessage>({
			originalMessages: messages,
			execute: ({ writer }) => {
				const providerStream = result.toUIMessageStream<ChatMessage>({
					sendSources: true,
					messageMetadata: ({ part }) =>
						part.type === "start" ? { createdAt: Date.now() } : undefined,
					onError: reportUiStreamError,
				});
				writer.merge(
					protectToolInputStream(providerStream, {
						toolName: "write_article",
						isValid: (input) => WriteArticleInput.safeParse(input).success,
						errorText: "La proposition d’article générée est invalide.",
					}),
				);
			},
			onEnd: async ({ messages: completedMessages, finishReason, isAborted }) => {
				if (isAborted || finishReason === "error") return;
				await saveContentChatMessages(
					body.contentId!,
					body.projectId!,
					user.id,
					completedMessages,
				);
			},
			onError: reportUiStreamError,
		});

		return createUIMessageStreamResponse({ stream: uiStream });

		function reportUiStreamError() {
			return "Le chat n’a pas pu terminer sa réponse.";
		}
	} catch (error) {
		return new Response(error instanceof Error ? error.message : "Erreur de chat.", {
			status: 500,
		});
	}
};

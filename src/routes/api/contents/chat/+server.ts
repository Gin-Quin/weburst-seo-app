import { getGoogleGenerativeAI, GOOGLE_CHAT_MODEL } from "$lib/server/ai/google";
import {
	describeChatError,
	logContentChatEvent,
	summarizeChatMessages,
} from "$lib/server/ai/chatDiagnostics";
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
	const requestId = crypto.randomUUID();
	const startedAt = Date.now();
	const elapsedMs = () => Date.now() - startedAt;
	const baseLog = (extra: Record<string, unknown> = {}) => ({
		requestId,
		elapsedMs: elapsedMs(),
		...extra,
	});

	logContentChatEvent(
		"info",
		"request_received",
		baseLog({
			contentLength: request.headers.get("content-length"),
			via: request.headers.get("via"),
			userAgent: request.headers.get("user-agent"),
		}),
	);
	request.signal.addEventListener(
		"abort",
		() => {
			logContentChatEvent("warn", "request_aborted", baseLog());
		},
		{ once: true },
	);

	try {
		const body = (await request.json()) as ChatRequest;
		if (!body.projectId || !body.contentId || !Array.isArray(body.messages)) {
			logContentChatEvent("warn", "request_invalid", baseLog());
			return new Response("Requête de chat invalide.", { status: 400 });
		}
		const user = await getRequestUser();
		await requireProjectAccess(user, body.projectId, "manage");

		const content = await getContentById(body.contentId, body.projectId);
		const google = getGoogleGenerativeAI();
		if (!google) {
			logContentChatEvent(
				"error",
				"provider_not_configured",
				baseLog({ userId: user?.id, projectId: body.projectId, contentId: body.contentId }),
			);
			return new Response("GEMINI_API_KEY n’est pas configurée.", { status: 503 });
		}

		const tools = {
			getArticleContext: tool({
				description:
					"Relire le contenu, le brief et les recommandations SEO les plus récents avant de répondre ou de modifier l’article.",
				inputSchema: z.object({}),
				execute: async () => {
					const latest = await getContentById(body.contentId!, body.projectId!);
					return {
						title: latest.title,
						existingUrl: latest.existingUrl,
						cluster: latest.cluster,
						brief: latest.brief,
						contentHtml: latest.contentHtml,
						contentText: latest.contentText,
						optimizationStatus: latest.serpmanticsStatus,
						optimizationError: latest.serpmanticsError,
						optimizationGuide: latest.serpmanticsGuide,
						optimizationAnalysis: latest.serpmanticsAnalysis,
					};
				},
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

		const messages = await validateUIMessages({ messages: body.messages });
		const modelMessages = await convertToModelMessages(messages, {
			tools,
			ignoreIncompleteToolCalls: true,
		});
		const diagnosticContext = {
			userId: user?.id,
			projectId: body.projectId,
			contentId: body.contentId,
			model: GOOGLE_CHAT_MODEL,
			messages: summarizeChatMessages(messages),
			modelMessageCount: modelMessages.length,
			contextLengths: {
				title: content.title.length,
				brief: content.brief.length,
				contentHtml: content.contentHtml.length,
				contentText: content.contentText.length,
				optimizationGuide: JSON.stringify(content.serpmanticsGuide ?? null).length,
				optimizationAnalysis: JSON.stringify(content.serpmanticsAnalysis ?? null).length,
			},
		};
		logContentChatEvent("info", "request_validated", baseLog(diagnosticContext));

		const result = streamText({
			// Article drafts are long JSON tool arguments. Wait for Gemini's complete
			// response so an interrupted provider stream cannot expose partial JSON.
			model: wrapLanguageModel({
				model: google(GOOGLE_CHAT_MODEL),
				middleware: simulateStreamingMiddleware(),
			}),
			instructions: buildSystemPrompt(content),
			// A provider or network interruption can leave a partial tool call in the
			// client history. Ignore it so the next user attempt can still be sent.
			messages: modelMessages,
			tools,
			stopWhen: stepCountIs(6),
			temperature: 0.4,
			onStart: ({ callId, provider, modelId }) => {
				logContentChatEvent(
					"info",
					"generation_started",
					baseLog({ ...diagnosticContext, callId, provider, modelId }),
				);
			},
			onLanguageModelCallStart: ({ callId, provider, modelId, tools: providerTools }) => {
				logContentChatEvent(
					"info",
					"provider_call_started",
					baseLog({ callId, provider, modelId, toolCount: providerTools?.length ?? 0 }),
				);
			},
			onLanguageModelCallEnd: ({
				callId,
				provider,
				modelId,
				finishReason,
				usage,
				content: providerContent,
				performance,
			}) => {
				logContentChatEvent(
					"info",
					"provider_call_finished",
					baseLog({
						callId,
						provider,
						modelId,
						finishReason,
						usage,
						contentTypes: providerContent.map((part) => part.type),
						responseTimeMs: performance.responseTimeMs,
					}),
				);
			},
			onToolExecutionStart: ({ callId, toolCall }) => {
				logContentChatEvent(
					"info",
					"tool_execution_started",
					baseLog({ callId, toolName: toolCall.toolName, toolCallId: toolCall.toolCallId }),
				);
			},
			onToolExecutionEnd: ({ callId, toolCall, toolOutput, toolExecutionMs }) => {
				logContentChatEvent(
					toolOutput.type === "tool-error" ? "error" : "info",
					"tool_execution_finished",
					baseLog({
						callId,
						toolName: toolCall.toolName,
						toolCallId: toolCall.toolCallId,
						toolOutputType: toolOutput.type,
						toolExecutionMs,
						...(toolOutput.type === "tool-error"
							? { error: describeChatError(toolOutput.error) }
							: {}),
					}),
				);
			},
			onStepEnd: ({ callId, stepNumber, finishReason, usage, text, toolCalls, performance }) => {
				logContentChatEvent(
					"info",
					"generation_step_finished",
					baseLog({
						callId,
						stepNumber,
						finishReason,
						usage,
						textLength: text.length,
						toolNames: toolCalls.map((toolCall) => toolCall.toolName),
						performance,
					}),
				);
			},
			onEnd: ({ callId, finishReason, usage, steps }) => {
				logContentChatEvent(
					"info",
					"generation_finished",
					baseLog({ callId, finishReason, usage, stepCount: steps.length }),
				);
			},
			onAbort: ({ steps }) => {
				logContentChatEvent(
					"warn",
					"generation_aborted",
					baseLog({
						stepCount: steps.length,
						requestAbortReason: request.signal.aborted
							? describeChatError(request.signal.reason)
							: undefined,
					}),
				);
			},
			onError: ({ error }) => {
				logContentChatEvent(
					"error",
					"generation_error",
					baseLog({ ...diagnosticContext, error: describeChatError(error) }),
				);
			},
		});

		return result.toUIMessageStreamResponse({
			headers: { "x-request-id": requestId },
			originalMessages: messages,
			messageMetadata: ({ part }) =>
				part.type === "start" ? { createdAt: Date.now() } : undefined,
			onEnd: async ({
				messages: completedMessages,
				responseMessage,
				finishReason,
				isAborted,
				isContinuation,
			}) => {
				logContentChatEvent(
					"info",
					"ui_stream_finished",
					baseLog({
						finishReason,
						isAborted,
						isContinuation,
						response: summarizeChatMessages([responseMessage])[0],
						completedMessageCount: completedMessages.length,
					}),
				);
				try {
					await saveContentChatMessages(body.contentId!, body.projectId!, completedMessages);
					logContentChatEvent(
						"info",
						"messages_persisted",
						baseLog({ completedMessageCount: completedMessages.length }),
					);
				} catch (error) {
					logContentChatEvent(
						"error",
						"message_persistence_error",
						baseLog({ error: describeChatError(error) }),
					);
					throw error;
				}
			},
			onError: (error) => {
				logContentChatEvent(
					"error",
					"ui_stream_error",
					baseLog({ ...diagnosticContext, error: describeChatError(error) }),
				);
				return "Le chat n’a pas pu terminer sa réponse.";
			},
			consumeSseStream: async ({ stream }) => {
				const reader = stream.getReader();
				let chunkCount = 0;
				let characterCount = 0;
				let sawFinish = false;
				let sawError = false;
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						chunkCount += 1;
						characterCount += value.length;
						sawFinish ||= value.includes('"type":"finish"');
						sawError ||= value.includes('"type":"error"');
					}
					logContentChatEvent(
						sawFinish && !sawError ? "info" : "warn",
						"sse_observer_closed",
						baseLog({ chunkCount, characterCount, sawFinish, sawError }),
					);
				} catch (error) {
					logContentChatEvent(
						"error",
						"sse_observer_error",
						baseLog({
							chunkCount,
							characterCount,
							sawFinish,
							sawError,
							error: describeChatError(error),
						}),
					);
				} finally {
					reader.releaseLock();
				}
			},
		});
	} catch (error) {
		logContentChatEvent("error", "request_error", baseLog({ error: describeChatError(error) }));
		return new Response(error instanceof Error ? error.message : "Erreur de chat.", {
			status: 500,
			headers: { "x-request-id": requestId },
		});
	}
};

function buildSystemPrompt(content: Awaited<ReturnType<typeof getContentById>>): string {
	return `Tu es un assistant éditorial SEO francophone intégré à WeBurst.
Tu aides l’utilisateur à écrire et optimiser l’article courant. Réponds en Markdown clair et concis.
N’invente jamais de données issues de l’analyse SEO. Appuie tes conseils sur le contexte ci-dessous.
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

DERNIER GUIDE D’OPTIMISATION SEO :
${JSON.stringify(content.serpmanticsGuide ?? null)}

DERNIÈRE ANALYSE SEO :
${JSON.stringify(content.serpmanticsAnalysis ?? null)}`;
}

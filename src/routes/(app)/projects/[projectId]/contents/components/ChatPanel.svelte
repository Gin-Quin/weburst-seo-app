<script lang="ts">
	import { getFailedUserMessageId } from "$lib/contents/chatRetry";
	import type { ContentDetail } from "$lib/server/contents";
	import { Chat } from "@ai-sdk/svelte";
	import { DefaultChatTransport, type UIMessage } from "ai";
	import DOMPurify from "dompurify";
	import { marked } from "marked";
	import IconArrowUpRegular from "phosphor-icons-svelte/IconArrowUpRegular.svelte";
	import IconChatCircleDotsRegular from "phosphor-icons-svelte/IconChatCircleDotsRegular.svelte";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import { clearContentChat } from "../../../../../api/contents/contents.remote";
	import ArticleChangesDialog from "./ArticleChangesDialog.svelte";

	type ChatMessage = UIMessage<{ createdAt?: number }>;
	type ArticleProposal = {
		toolCallId: string;
		currentHtml: string;
		markdown: string;
		summary: string;
	};

	let {
		content,
		onBeforeSend,
		onConversationFinished,
		onArticleAccepted,
		sendChatPrompt = $bindable(),
	}: {
		content: ContentDetail;
		onBeforeSend: () => Promise<void>;
		onConversationFinished: () => void | Promise<void>;
		onArticleAccepted: (html: string) => Promise<void>;
		sendChatPrompt?: (prompt: string) => void;
	} = $props();

	let input = $state("");
	let preparing = $state(false);
	let clearing = $state(false);
	let acceptingProposal = $state(false);
	let articleProposal = $state<ArticleProposal | undefined>();
	let messagesElement: HTMLDivElement;
	let scrollTimeout: ReturnType<typeof setTimeout>;
	const scrollAfterSendDelay = 100;
	const chat = new Chat<ChatMessage>({
		id: `content-${content.id}`,
		messages: content.chatMessages as ChatMessage[],
		transport: new DefaultChatTransport({
			api: "/api/contents/chat",
			body: { projectId: content.projectId, contentId: content.id },
		}),
		onToolCall: ({ toolCall }) => {
			if (toolCall.toolName !== "write_article" || !isWriteArticleInput(toolCall.input)) return;
			articleProposal = {
				toolCallId: toolCall.toolCallId,
				currentHtml: content.contentHtml,
				markdown: toolCall.input.content,
				summary: toolCall.input.summary,
			};
		},
		onFinish: () => {
			if (!articleProposal) void onConversationFinished();
		},
	});

	function isWriteArticleInput(value: unknown): value is { content: string; summary: string } {
		return Boolean(
			value &&
				typeof value === "object" &&
				typeof (value as { content?: unknown }).content === "string" &&
				typeof (value as { summary?: unknown }).summary === "string",
		);
	}

	async function acceptProposal(html: string) {
		if (!articleProposal || acceptingProposal) return;
		acceptingProposal = true;
		try {
			await onArticleAccepted(html);
			await chat.addToolOutput({
				tool: "write_article",
				toolCallId: articleProposal.toolCallId,
				output: { status: "accepted" },
			});
			articleProposal = undefined;
			toast.success("Article accepté", { richColors: true });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Impossible d’appliquer l’article.", {
				richColors: true,
			});
		} finally {
			acceptingProposal = false;
		}
	}

	function cancelProposal() {
		if (!articleProposal || acceptingProposal) return;
		void chat.addToolOutput({
			tool: "write_article",
			toolCallId: articleProposal.toolCallId,
			output: { status: "cancelled" },
		});
		articleProposal = undefined;
	}

	sendChatPrompt = (prompt: string) => {
		void sendPrompt(prompt).catch(() => undefined);
	};

	async function sendPrompt(prompt: string) {
		if (!prompt.trim() || preparing || chat.status === "streaming" || chat.status === "submitted") return;
		const failedMessageId = getFailedUserMessageId(chat.messages, chat.status);
		preparing = true;
		try {
			await onBeforeSend();
			const response = chat.sendMessage({
				text: prompt.trim(),
				metadata: { createdAt: Date.now() },
				messageId: failedMessageId,
			});
			scheduleScrollToBottom(scrollAfterSendDelay);
			await response;
		} finally {
			preparing = false;
		}
	}

	async function retryLastMessage() {
		if (preparing || chat.status !== "error") return;
		preparing = true;
		try {
			await onBeforeSend();
			const response = chat.regenerate();
			scheduleScrollToBottom(scrollAfterSendDelay);
			await response;
		} finally {
			preparing = false;
		}
	}

	function scheduleScrollToBottom(delay: number) {
		clearTimeout(scrollTimeout);
		scrollTimeout = setTimeout(() => {
			messagesElement?.scrollTo({ top: messagesElement.scrollHeight, behavior: "smooth" });
		}, delay);
	}

	onMount(() => {
		scheduleScrollToBottom(0);
		return () => clearTimeout(scrollTimeout);
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const prompt = input.trim();
		if (!prompt) return;
		input = "";
		sendChatPrompt?.(prompt);
	}

	async function clearConversation() {
		if (clearing || chat.status === "submitted" || chat.status === "streaming") return;
		clearing = true;
		try {
			await clearContentChat({ id: content.id, projectId: content.projectId });
			chat.messages = [];
			toast.success("Chat effacé", { richColors: true });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Impossible d’effacer le chat.", {
				richColors: true,
			});
		} finally {
			clearing = false;
		}
	}

	function markdown(text: string) {
		return DOMPurify.sanitize(marked.parse(text, { async: false }) as string);
	}

	function messageTimestamp(message: ChatMessage) {
		return message.metadata?.createdAt ?? content.updatedAt;
	}

	function messageDate(message: ChatMessage) {
		return new Intl.DateTimeFormat("fr-FR", {
			day: "numeric",
			month: "long",
			hour: "2-digit",
			minute: "2-digit",
		}).format(messageTimestamp(message));
	}

	function toolLabel(type: string) {
		const name = type.replace(/^tool-/, "");
		return {
			getArticleContext: "Contexte de l’article relu",
			write_article: "Proposition d’article prête",
			replaceArticle: "Article mis à jour",
			updateBrief: "Brief mis à jour",
			refreshSeoAnalysis: "Analyse SEO actualisée",
		}[name] ?? `Outil utilisé : ${name}`;
	}
</script>

<section class="ChatPanel">
	<div class="Messages" bind:this={messagesElement}>
		{#if chat.messages.length === 0}
			<div class="EmptyChat">
				<IconChatCircleDotsRegular class="EmptyIcon" />
				<p><strong>Aucune discussion enregistrée</strong><br />Initiez le chat via l’espace ci-dessous.</p>
			</div>
		{:else}
			<div class="MessageList">
				{#each chat.messages as message, index (`${message.id}:${index}`)}
					<div class="Message message-{message.role}">
						<div class="MessageBody">
							{#each message.parts as part}
								{#if part.type === "text"}
									<div class="Markdown">{@html markdown(part.text)}</div>
								{:else if part.type.startsWith("tool-")}
									<div class="ToolPart">✓ {toolLabel(part.type)}</div>
								{/if}
							{/each}
						</div>
						{#if message.role === "user"}
							<time class="MessageTime" datetime={new Date(messageTimestamp(message)).toISOString()}>{messageDate(message)}</time>
						{/if}
					</div>
				{/each}
				{#if chat.status === "submitted" || chat.status === "streaming"}
					<div class="Typing"><span></span><span></span><span></span></div>
				{/if}
			</div>
		{/if}
	</div>

	{#if chat.error}
		<div class="ChatError">
			<span>{chat.error.message}</span>
			<button type="button" disabled={preparing} onclick={() => void retryLastMessage()}>Réessayer</button>
		</div>
	{/if}
	{#if chat.messages.length > 0}
		<button
			class="ClearChatButton"
			type="button"
			disabled={clearing || chat.status === "submitted" || chat.status === "streaming"}
			onclick={clearConversation}
		>
			{clearing ? "Effacement…" : "Effacer le chat"}
		</button>
	{/if}
	<form class="ChatComposer" onsubmit={submit}>
		<textarea
			bind:value={input}
			placeholder="Écrire un message..."
			onkeydown={(event) => {
				if (event.key === "Enter" && !event.shiftKey) {
					event.preventDefault();
					(event.currentTarget.form as HTMLFormElement)?.requestSubmit();
				}
			}}
		></textarea>
		<button class="SendButton" type="submit" disabled={!input.trim() || preparing || chat.status === "submitted" || chat.status === "streaming"} aria-label="Envoyer">
			<IconArrowUpRegular class="icon" />
		</button>
	</form>
</section>

{#if articleProposal}
	<ArticleChangesDialog
		currentHtml={articleProposal.currentHtml}
		proposedMarkdown={articleProposal.markdown}
		guide={content.serpmanticsGuide}
		accepting={acceptingProposal}
		onAccept={acceptProposal}
		onCancel={cancelProposal}
	/>
{/if}

<style>
	.ChatPanel { height: 100%; min-height: 0; display: grid; grid-template-rows: 1fr auto auto; }
	.Messages { min-height: 0; overflow-y: auto; padding: 1.25rem 1rem 1.5rem 1.5rem; }
	.MessageList { min-height: 100%; display: flex; flex-direction: column; justify-content: flex-end; gap: 1.75rem; }
	.EmptyChat { flex: 1; min-height: 28rem; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--color-text-light); }
	.EmptyIcon { width: 3.5rem; height: 3.5rem; color: #999; margin-bottom: 0.5rem; }
	.Message { display: flex; flex-direction: column; line-height: 1.48; }
	.message-user { align-self: flex-end; align-items: flex-end; width: fit-content; max-width: calc(100% - 4.75rem); }
	.message-user .MessageBody { width: 100%; padding: 0.8rem 0.9rem; color: var(--color-base-content); background: #f8f4ff; border: 1px solid #e4d8ff; border-radius: 0.65rem; }
	.message-assistant { align-self: stretch; align-items: flex-start; max-width: 100%; }
	.message-assistant .MessageBody { width: 100%; }
	.MessageTime { margin-top: 0.35rem; color: var(--color-text-light); font-size: 0.75rem; line-height: 1.25; }
	.Markdown :global(p) { margin: 0; }
	.Markdown :global(p + p) { margin-top: 0.45rem; }
	.Markdown :global(ul), .Markdown :global(ol) { padding-left: 1.25rem; margin: 0.45rem 0; }
	.Markdown :global(ul) { list-style: disc; }
	.Markdown :global(ol) { list-style: decimal; }
	.Markdown :global(h1), .Markdown :global(h2), .Markdown :global(h3) { font-weight: 700; margin: 0.75rem 0 0.35rem; }
	.Markdown :global(h1) { font-size: 1.4rem; } .Markdown :global(h2) { font-size: 1.25rem; } .Markdown :global(h3) { font-size: 1.1rem; }
	.Markdown :global(code) { background: #f1eef7; padding: 0.1rem 0.3rem; border-radius: 0.3rem; }
	.Markdown :global(pre) { background: #17141d; color: white; padding: 0.75rem; overflow-x: auto; border-radius: 0.5rem; }
	.Markdown :global(a) { color: var(--color-primary); text-decoration: underline; }
	.Markdown :global(hr) { margin-block: 4px; }
	.ToolPart { margin-block: 8px; font-size: 0.82rem; color: #176b2a; background: #e9ffee; padding: 0.35rem 0.5rem; border-radius: 0.4rem; }
	.Typing { align-self: flex-start; background: white; border: 1px solid var(--color-border); border-radius: 1rem; padding: 0.7rem 1rem; display: flex; gap: 0.25rem; }
	.Typing span { width: 0.45rem; height: 0.45rem; border-radius: 50%; background: #999; animation: pulse 1s infinite alternate; }
	.Typing span:nth-child(2) { animation-delay: 0.2s; } .Typing span:nth-child(3) { animation-delay: 0.4s; }
	.ChatError { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; color: var(--color-error); padding: 0.5rem 1rem; font-size: 0.85rem; }
	.ChatError button { flex: 0 0 auto; border: 0; padding: 0; background: transparent; color: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
	.ChatError button:disabled { opacity: 0.45; cursor: default; }
	.ClearChatButton { justify-self: end; margin: 0 1rem 0.4rem; padding: 0; border: 0; background: transparent; color: var(--color-text-light); font-size: calc(0.7rem + 1px); line-height: 1; cursor: pointer; }
	.ClearChatButton:hover { color: var(--color-base-content); }
	.ClearChatButton:disabled { opacity: 0.45; cursor: default; }
	.ChatComposer { min-height: 4.5rem; margin: 0 0.75rem 0.75rem; padding: 0.65rem 0.75rem; background: white; border: 1px solid var(--color-border); border-radius: 0.7rem; display: flex; align-items: flex-end; gap: 0.5rem; }
	.ChatComposer textarea { flex: 1; min-height: 2.5rem; max-height: 9rem; border: 0; padding: 0.45rem 0.25rem; font-size: 1rem; line-height: 1.4; background: transparent; }
	.SendButton { flex: 0 0 auto; width: 2.5rem; height: 2.5rem; border-radius: 0.4rem; background: var(--color-primary); color: white; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 150ms ease, color 150ms ease; }
	.SendButton :global(.icon) { width: 1.45rem; height: 1.45rem; }
	.SendButton:disabled { background: rgb(197 164 255 / 45%); color: rgb(255 255 255 / 80%); cursor: default; }
	@keyframes pulse { to { opacity: 0.25; transform: translateY(-2px); } }
</style>

<script lang="ts">
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import IconArrowSquareOutRegular from "phosphor-icons-svelte/IconArrowSquareOutRegular.svelte";
	import IconArrowsClockwiseRegular from "phosphor-icons-svelte/IconArrowsClockwiseRegular.svelte";
	import IconCheckCircleRegular from "phosphor-icons-svelte/IconCheckCircleRegular.svelte";
	import IconCopyRegular from "phosphor-icons-svelte/IconCopyRegular.svelte";
	import IconKeyRegular from "phosphor-icons-svelte/IconKeyRegular.svelte";
	import IconLinkRegular from "phosphor-icons-svelte/IconLinkRegular.svelte";
	import IconShieldCheckRegular from "phosphor-icons-svelte/IconShieldCheckRegular.svelte";
	import IconTerminalRegular from "phosphor-icons-svelte/IconTerminalRegular.svelte";
	import IconTrashRegular from "phosphor-icons-svelte/IconTrashRegular.svelte";
	import {
		createMcpApiKey,
		deleteMcpApiKey,
		getMcpConnectionInfo,
		type McpConnectionInfo,
	} from "../../../api/mcp.remote";

	let connection = $state<McpConnectionInfo | null>(null);
	let generatedKey = $state("");
	let loading = $state(true);
	let working = $state(false);
	const isLocalServer = $derived(connection?.serverUrl.startsWith("http://localhost") ?? false);

	onMount(() => void loadConnection());

	async function loadConnection() {
		try {
			connection = await getMcpConnectionInfo();
		} catch {
			toast.error("Impossible de charger la connexion MCP", { richColors: true });
		} finally {
			loading = false;
		}
	}

	async function generateKey() {
		if (connection?.hasKey && !window.confirm("L’ancienne clé cessera immédiatement de fonctionner. Continuer ?")) {
			return;
		}
		working = true;
		try {
			generatedKey = await createMcpApiKey();
			await loadConnection();
			toast.success("Nouvelle clé MCP créée", { richColors: true });
		} catch {
			toast.error("Impossible de créer la clé MCP", { richColors: true });
		} finally {
			working = false;
		}
	}

	async function revokeKey() {
		if (!window.confirm("Révoquer cette clé MCP ? Les connexions directes l’utilisant seront coupées.")) return;
		working = true;
		try {
			await deleteMcpApiKey();
			generatedKey = "";
			await loadConnection();
			toast.success("Clé MCP révoquée", { richColors: true });
		} catch {
			toast.error("Impossible de révoquer la clé MCP", { richColors: true });
		} finally {
			working = false;
		}
	}

	async function copy(value: string, message = "Copié dans le presse-papiers") {
		await navigator.clipboard.writeText(value);
		toast.success(message, { richColors: true });
	}

	async function openConnector(url: string, platform: string) {
		if (!connection) return;
		await copy(connection.serverUrl, "URL MCP copiée");
		window.open(url, "_blank", "noopener,noreferrer");
		toast.message(`Collez l’URL dans ${platform}, puis autorisez WeBurst.`);
	}

	async function copyServerUrl() {
		if (connection) await copy(connection.serverUrl, "URL MCP copiée");
	}

	function codexCommand() {
		return `codex mcp add weburst --url ${connection?.serverUrl}\ncodex mcp login weburst`;
	}

	function directCodexCommand() {
		return `export WEBURST_MCP_KEY='${generatedKey}'\ncodex mcp add weburst --url ${connection?.serverUrl} --bearer-token-env-var WEBURST_MCP_KEY`;
	}

	function directClaudeCommand() {
		return `claude mcp add --transport http --scope user --header "Authorization: Bearer ${generatedKey}" weburst ${connection?.serverUrl}`;
	}

	function formatDate(value: number | null) {
		return value
			? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(value)
			: "Jamais";
	}
</script>

<svelte:head>
	<title>Connexion MCP — WeBurst</title>
</svelte:head>

<div class="PageWrap">
	<section class="McpPage">
		<header class="PageHeader">
			<div class="HeaderIcon"><IconLinkRegular /></div>
			<div>
				<h1>Connexion MCP</h1>
				<p>Retrouvez vos projets, clients et contenus WeBurst dans vos assistants IA.</p>
			</div>
		</header>

		{#if loading}
			<div class="LoadingState">Chargement de votre connexion…</div>
		{:else if connection}
			{#if isLocalServer}
				<div class="LocalWarning">
					<strong>Serveur local</strong>
					ChatGPT et les connecteurs partagés de Claude nécessitent une URL HTTPS publique. Les connexions CLI directes de Codex et Claude Code peuvent utiliser cette URL locale depuis votre machine.
				</div>
			{/if}

			<section class="KeyCard" aria-labelledby="mcp-key-title">
				<div class="CardHeading">
					<div class="CardIcon"><IconKeyRegular /></div>
					<div>
						<h2 id="mcp-key-title">Clé d’accès personnelle</h2>
						<p>Elle identifie votre profil. WeBurst ne conserve que son empreinte chiffrée.</p>
					</div>
					<span class:active={connection.hasKey} class="StatusBadge">
						{connection.hasKey ? "Active" : "Inactive"}
					</span>
				</div>

				{#if generatedKey}
					<div class="SecretReveal">
						<div>
							<strong>Copiez cette clé maintenant</strong>
							<small>Elle ne sera plus affichée après avoir quitté cette page.</small>
						</div>
						<div class="CopyField">
							<code>{generatedKey}</code>
							<button class="btn control-size-1" onclick={() => copy(generatedKey, "Clé MCP copiée")}>
								<IconCopyRegular /> Copier
							</button>
						</div>
					</div>
				{:else if connection.hasKey}
					<div class="KeySummary">
						<div>
							<small>Clé active</small>
							<code>{connection.prefix}••••••••••••</code>
						</div>
						<div>
							<small>Créée</small>
							<span>{formatDate(connection.createdAt)}</span>
						</div>
						<div>
							<small>Dernière utilisation</small>
							<span>{formatDate(connection.lastUsedAt)}</span>
						</div>
					</div>
				{:else}
					<div class="EmptyKey">
						<IconShieldCheckRegular />
						<div><strong>Aucune clé active</strong><span>Créez-en une avant de connecter un assistant.</span></div>
					</div>
				{/if}

				<div class="KeyActions">
					<button class="btn btn-primary" disabled={working} onclick={generateKey}>
						{#if connection.hasKey}<IconArrowsClockwiseRegular /> Régénérer{:else}<IconKeyRegular /> Générer ma clé{/if}
					</button>
					{#if connection.hasKey}
						<button class="btn DangerButton" disabled={working} onclick={revokeKey}>
							<IconTrashRegular /> Révoquer
						</button>
					{/if}
				</div>
			</section>

			<section class="ServerCard">
				<div>
					<h2>URL du serveur</h2>
					<p>Endpoint MCP Streamable HTTP, en lecture seule.</p>
				</div>
				<div class="CopyField">
					<code>{connection.serverUrl}</code>
					<button class="btn control-size-1" onclick={copyServerUrl}>
						<IconCopyRegular /> Copier
					</button>
				</div>
			</section>

			<section class="Connections" aria-labelledby="connections-title">
				<div class="SectionTitle">
					<h2 id="connections-title">Connecter un assistant</h2>
					<p>L’URL est copiée automatiquement avant d’ouvrir les réglages.</p>
				</div>

				<div class="ConnectionGrid">
					<article class="ConnectionCard">
						<div class="PlatformMark openai"><img src="/brands/openai.svg" alt="" /></div>
						<div><h3>ChatGPT</h3><p>Application MCP personnalisée avec autorisation OAuth.</p></div>
						<button class="btn btn-primary" disabled={!connection.hasKey || isLocalServer} onclick={() => openConnector("https://chatgpt.com/#settings/Apps", "ChatGPT")}>
							Connecter à ChatGPT <IconArrowSquareOutRegular />
						</button>
						<small>Paramètres → Applications → Créer, après activation du mode développeur.</small>
					</article>

					<article class="ConnectionCard">
						<div class="PlatformMark openai"><img src="/brands/openai.svg" alt="" /></div>
						<div><h3>Codex</h3><p>Ajout à Codex CLI et à l’application via OAuth.</p></div>
						<button class="btn btn-primary" disabled={!connection.hasKey} onclick={() => copy(codexCommand(), "Commande Codex copiée")}>
							<IconTerminalRegular /> Connecter à Codex
						</button>
						<small>Collez les deux commandes dans votre terminal.</small>
					</article>

					<article class="ConnectionCard">
						<div class="PlatformMark anthropic"><img src="/brands/anthropic.svg" alt="" /></div>
						<div><h3>Claude</h3><p>Un seul connecteur distant, partagé avec Claude Web, Desktop, Cowork et Code.</p></div>
						<button class="btn btn-primary" disabled={!connection.hasKey || isLocalServer} onclick={() => openConnector("https://claude.ai/#settings/customize-connectors", "Claude")}>
							Connecter à Claude <IconArrowSquareOutRegular />
						</button>
						<small>Ajouter → Connecteur personnalisé, puis collez l’URL. La connexion sera disponible sur tous vos clients Claude.</small>
					</article>
				</div>
			</section>

			<details class="AdvancedCard">
				<summary><IconTerminalRegular /> Connexion directe par clé pour les CLI</summary>
				{#if generatedKey}
					<p>Alternative à OAuth. Ces commandes contiennent votre clé : ne les partagez pas.</p>
					<div class="CommandBlock">
						<div><strong>Codex</strong><button onclick={() => copy(directCodexCommand())}><IconCopyRegular /> Copier</button></div>
						<pre>{directCodexCommand()}</pre>
					</div>
					<div class="CommandBlock">
						<div><strong>Claude Code</strong><button onclick={() => copy(directClaudeCommand())}><IconCopyRegular /> Copier</button></div>
						<pre>{directClaudeCommand()}</pre>
					</div>
				{:else}
					<p>La clé complète n’est affichée qu’à sa création. Régénérez-la pour obtenir les commandes prêtes à copier.</p>
				{/if}
			</details>

			<footer class="SecurityNote">
				<IconCheckCircleRegular />
				<div><strong>Accès strictement limité au profil</strong><span>Les outils MCP sont en lecture seule et appliquent les mêmes permissions que l’interface WeBurst.</span></div>
			</footer>
		{/if}
	</section>
</div>

<style>
	.PageWrap { padding: 2rem 2.5rem; }
	.McpPage { display: flex; flex-direction: column; gap: 1.5rem; max-width: 76rem; margin: 0 auto; padding: 2rem 2.5rem; border: 1px solid var(--color-border); border-radius: 1.25rem; background: var(--color-base-100); }
	.PageHeader { display: flex; align-items: center; gap: 1rem; padding-bottom: .5rem; }
	.PageHeader h1 { margin: 0; font-size: 1.75rem; font-weight: 700; }
	.PageHeader p, .CardHeading p, .ServerCard p, .SectionTitle p { margin: .25rem 0 0; color: var(--color-text-light); }
	.HeaderIcon, .CardIcon { display: grid; place-items: center; flex: 0 0 auto; width: 3rem; height: 3rem; border-radius: 1rem; background: var(--color-primary-light); color: var(--color-primary); }
	.HeaderIcon :global(svg), .CardIcon :global(svg) { width: 1.5rem; height: 1.5rem; }
	.KeyCard, .ServerCard, .AdvancedCard { padding: 1.5rem; border: 1px solid var(--color-border); border-radius: 1.25rem; background: #fff; }
	.CardHeading { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 1rem; }
	h2 { margin: 0; font-size: 1.15rem; font-weight: 700; }
	.StatusBadge { padding: .35rem .7rem; border-radius: 999px; background: var(--color-gray-2); color: var(--color-text-light); font-size: .8rem; font-weight: 650; }
	.StatusBadge.active { background: #e9ffee; color: #1c6f2f; }
	.SecretReveal { display: grid; gap: .75rem; margin-top: 1.5rem; padding: 1rem; border: 1px solid #d9c4ff; border-radius: 1rem; background: #fbf8ff; }
	.SecretReveal small, .KeySummary small, .ConnectionCard small { color: var(--color-text-light); }
	.CopyField { display: flex; align-items: center; gap: .75rem; min-width: 0; padding: .45rem .45rem .45rem .9rem; border: 1px solid var(--color-border); border-radius: .9rem; background: var(--color-gray-1); }
	.CopyField code { flex: 1; min-width: 0; overflow: hidden; color: #332847; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .84rem; text-overflow: ellipsis; white-space: nowrap; }
	.CopyField button { flex: 0 0 auto; }
	.KeySummary { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 1rem; margin-top: 1.5rem; }
	.KeySummary > div { display: flex; flex-direction: column; gap: .35rem; padding: .9rem 1rem; border-radius: .9rem; background: var(--color-gray-1); }
	.KeySummary code { color: #332847; font-size: .85rem; }
	.EmptyKey { display: flex; align-items: center; gap: .8rem; margin-top: 1.5rem; padding: 1rem; border-radius: 1rem; background: var(--color-gray-1); }
	.EmptyKey :global(svg) { width: 1.5rem; height: 1.5rem; color: var(--color-text-light); }
	.EmptyKey div { display: flex; flex-direction: column; }
	.EmptyKey span { color: var(--color-text-light); font-size: .9rem; }
	.KeyActions { display: flex; gap: .75rem; margin-top: 1.25rem; }
	.DangerButton { color: #b32629; }
	.ServerCard { display: grid; grid-template-columns: minmax(12rem, .7fr) minmax(20rem, 1.3fr); align-items: center; gap: 1.5rem; }
	.LocalWarning { padding: 1rem 1.15rem; border: 1px solid #f0d7a7; border-radius: 1rem; background: #fff8e8; color: #775418; line-height: 1.45; }
	.LocalWarning strong { display: block; color: #51370e; }
	.Connections { display: flex; flex-direction: column; gap: 1rem; }
	.SectionTitle { padding-top: .5rem; }
	.ConnectionGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
	.ConnectionCard { display: flex; flex-direction: column; gap: 1rem; min-height: 17rem; padding: 1.25rem; border: 1px solid var(--color-border); border-radius: 1.15rem; background: #fff; }
	.ConnectionCard h3 { margin: 0; font-size: 1.05rem; font-weight: 700; }
	.ConnectionCard p { margin: .3rem 0 0; color: var(--color-text-light); font-size: .92rem; line-height: 1.45; }
	.ConnectionCard .btn { width: 100%; margin-top: auto; }
	.PlatformMark { display: grid; place-items: center; width: 2.65rem; height: 2.65rem; border-radius: .85rem; }
	.PlatformMark img { width: 1.45rem; height: 1.45rem; }
	.PlatformMark.openai { background: #111; }
	.PlatformMark.openai img { filter: invert(1); }
	.PlatformMark.anthropic { background: #f0e4d6; }
	.AdvancedCard summary { display: flex; align-items: center; gap: .6rem; cursor: pointer; font-weight: 700; }
	.AdvancedCard summary :global(svg) { width: 1.25rem; }
	.AdvancedCard > p { color: var(--color-text-light); }
	.CommandBlock { margin-top: 1rem; overflow: hidden; border: 1px solid var(--color-border); border-radius: .9rem; }
	.CommandBlock > div { display: flex; align-items: center; justify-content: space-between; padding: .65rem .85rem; background: var(--color-gray-1); }
	.CommandBlock button { display: flex; align-items: center; gap: .35rem; border: 0; background: transparent; color: var(--color-primary); cursor: pointer; }
	.CommandBlock pre { margin: 0; padding: 1rem; overflow-x: auto; background: #17131f; color: #f5efff; font-size: .8rem; white-space: pre-wrap; word-break: break-word; }
	.SecurityNote { display: flex; align-items: center; gap: .8rem; padding: 1rem 1.15rem; border-radius: 1rem; background: #f5f8ff; color: #153a9d; }
	.SecurityNote :global(svg) { flex: 0 0 auto; width: 1.5rem; height: 1.5rem; }
	.SecurityNote div { display: flex; flex-direction: column; }
	.SecurityNote span { color: #4d638e; font-size: .9rem; }
	.LoadingState { padding: 4rem; color: var(--color-text-light); text-align: center; }
	@media (max-width: 1000px) {
		.ConnectionGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
	@media (max-width: 720px) {
		.PageWrap, .McpPage { padding: 1rem; }
		.CardHeading { grid-template-columns: auto minmax(0, 1fr); }
		.StatusBadge { grid-column: 2; justify-self: start; }
		.KeySummary, .ServerCard, .ConnectionGrid { grid-template-columns: 1fr; }
		.KeyActions { flex-direction: column; }
	}
</style>

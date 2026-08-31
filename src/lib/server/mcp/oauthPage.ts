import type { OauthAuthorizationRequest } from "./oauth";

export function renderOauthAuthorizationPage(
	request: OauthAuthorizationRequest,
	error?: string,
): string {
	const fields: Array<[string, string]> = [
		["response_type", "code"],
		["client_id", request.clientId],
		["redirect_uri", request.redirectUri],
		["code_challenge", request.codeChallenge],
		["code_challenge_method", "S256"],
		["scope", request.scope],
		["resource", request.resource],
		["state", request.state ?? ""],
	];
	const hiddenFields = fields
		.map(
			([name, value]) =>
				`<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
		)
		.join("\n");

	return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Autoriser ${escapeHtml(request.clientName)} — WeBurst</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #111; background: #faf8ff; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; }
    main { width: min(100%, 520px); padding: 36px; border: 1px solid #eee; border-radius: 28px; background: #fff; box-shadow: 0 18px 55px rgba(34, 22, 55, .08); }
    img { width: 148px; height: auto; display: block; margin-bottom: 32px; }
    h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.2; }
    p { color: #656565; line-height: 1.55; }
    .permission { display: flex; gap: 12px; padding: 16px; margin: 24px 0; border-radius: 16px; background: #f5f8ff; color: #153a9d; }
    .permission strong { display: block; color: #11182d; margin-bottom: 4px; }
    label { display: block; margin: 24px 0 8px; font-size: 14px; font-weight: 650; }
    input[type=password] { width: 100%; height: 48px; padding: 0 16px; border: 1px solid #dedede; border-radius: 13px; font: inherit; }
    input[type=password]:focus { outline: none; border-color: #9453f4; box-shadow: 0 0 0 3px #f2e9ff; }
    small { display: block; margin-top: 8px; color: #777; line-height: 1.4; }
    .actions { display: grid; grid-template-columns: 1fr 1.5fr; gap: 12px; margin-top: 28px; }
    button { min-height: 48px; border: 1px solid #dedede; border-radius: 13px; background: white; font: inherit; font-weight: 650; cursor: pointer; }
    button.primary { border-color: #9453f4; background: #9453f4; color: white; }
    button:disabled { opacity: .6; cursor: wait; }
    #error { display: ${error ? "block" : "none"}; margin-top: 16px; padding: 12px 14px; border-radius: 12px; background: #fff0f0; color: #a51d20; }
  </style>
</head>
<body>
  <main>
    <img src="/weburst-logo.png" alt="WeBurst">
    <h1>Autoriser ${escapeHtml(request.clientName)}</h1>
    <p>Cette connexion utilisera uniquement les données accessibles à votre profil WeBurst.</p>
    <div class="permission">
      <span aria-hidden="true">✓</span>
      <div><strong>Accès en lecture seule</strong>Projets, clients autorisés et contenus éditoriaux.</div>
    </div>
    <form method="post" action="/oauth/authorize" id="oauth-form">
      ${hiddenFields}
      <label for="api-key">Clé MCP WeBurst</label>
      <input id="api-key" name="api_key" type="password" autocomplete="off" placeholder="wb_mcp_…">
      <small>Facultatif si vous êtes déjà connecté à WeBurst dans ce navigateur. Sinon, copiez la clé depuis Paramètres → Connexion MCP.</small>
      <div id="error" role="alert">${escapeHtml(error ?? "")}</div>
      <div class="actions">
        <button type="submit" name="action" value="deny">Annuler</button>
        <button class="primary" type="submit" name="action" value="approve">Autoriser</button>
      </div>
    </form>
  </main>
  <script>
    const form = document.getElementById("oauth-form");
    const errorBox = document.getElementById("error");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const buttons = form.querySelectorAll("button");
      buttons.forEach((button) => button.disabled = true);
      errorBox.style.display = "none";
      const data = new URLSearchParams(new FormData(form));
      data.set("action", event.submitter?.value || "approve");
      const headers = { "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded" };
      const session = localStorage.getItem("bearer");
      if (session) headers.Authorization = "Bearer " + session;
      try {
        const endpoint = form.getAttribute("action") || window.location.pathname;
        const response = await fetch(endpoint, { method: "POST", headers, body: data });
        const isJson = response.headers.get("content-type")?.includes("application/json");
        const payload = isJson ? await response.json() : null;
        if (!response.ok) {
          throw new Error(payload?.error_description || "Autorisation impossible (HTTP " + response.status + ").");
        }
        if (!payload?.redirect) throw new Error("Réponse d’autorisation invalide.");
        window.location.assign(payload.redirect);
      } catch (error) {
        errorBox.textContent = error instanceof Error ? error.message : "Autorisation impossible.";
        errorBox.style.display = "block";
        buttons.forEach((button) => button.disabled = false);
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

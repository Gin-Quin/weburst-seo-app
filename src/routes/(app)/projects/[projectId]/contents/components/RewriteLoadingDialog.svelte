<div class="DialogBackdrop" role="presentation">
	<dialog open class="LoadingDialog" aria-modal="true" aria-labelledby="rewrite-loading-title">
		<div class="Spinner" aria-hidden="true"></div>
		<h2 id="rewrite-loading-title">Réécriture en cours</h2>
		<p>Veuillez patienter, les modifications sont en cours de réalisation pour le passage sélectionné.</p>
	</dialog>
</div>

<style>
	.DialogBackdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		padding: 1.5rem;
		background: rgb(38 32 48 / 24%);
		backdrop-filter: blur(1px);
	}

	.LoadingDialog {
		position: relative;
		inset: auto;
		width: min(760px, calc(100vw - 3rem));
		max-width: 100%;
		margin: 0;
		padding: 3.25rem 3rem 3.5rem;
		text-align: center;
		background: white;
		border: 1px solid rgb(229 226 234);
		border-radius: 2rem;
		box-shadow: 0 24px 70px rgb(28 17 49 / 18%);
		box-sizing: border-box;
	}

	.Spinner {
		width: 2.75rem;
		height: 2.75rem;
		margin: 0 auto 1.25rem;
		border: 3px solid #e9ddff;
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 850ms linear infinite;
	}

	h2 {
		margin: 0;
		color: #0e0c10;
		font-size: clamp(1.75rem, 4vw, 2.35rem);
		line-height: 1.15;
		font-weight: 750;
		letter-spacing: -0.03em;
	}

	p {
		max-width: 36rem;
		margin: 0.8rem auto 0;
		color: #29232e;
		font-size: 1.05rem;
		line-height: 1.45;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@media (prefers-reduced-motion: reduce) {
		.Spinner { animation-duration: 1.8s; }
	}

	@media (max-width: 600px) {
		.DialogBackdrop { padding: 0.75rem; }
		.LoadingDialog { width: calc(100vw - 1.5rem); padding: 2.5rem 1.5rem; border-radius: 1.4rem; }
	}
</style>

<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";
	import type { context } from "$lib/stores/context.svelte";

	const content = defineContent({
		en: {
			confirm: "Confirm",
			cancel: "Cancel",
		},
		fr: {
			confirm: "Confirmer",
			cancel: "Annuler",
		},
	});

	let {
		openConfirmDialog = $bindable(),
	}: {
		openConfirmDialog: (typeof context)["openConfirmDialog"];
	} = $props();

	let ref: HTMLDialogElement | undefined;
	let loading = $state(false);
	let title = $state("");
	let then = $state<() => unknown>(() => {});
	let color = $state<
		| "info"
		| "success"
		| "warning"
		| "error"
		| "primary"
		| "secondary"
		| "accent"
	>("error");
	let description = $state<string | undefined>();

	openConfirmDialog = (input) => {
		title = input.title;
		description = input.description;
		then = input.then;
		color = input.color ?? "error";
		ref?.showModal();
	};

	async function submit() {
		loading = true;
		await then?.();
		loading = false;
		ref?.close();
	}
</script>

<dialog bind:this={ref} class="modal">
	<div class="modal-box w-[32rem]">
		<!-- <header>
			{}
		</header> -->

		<form method="dialog" class="col gap-6 items-stretch">
			<div class="col gap-3">
				<main class="center bold text-2xl text-center">
					{@html title}
				</main>

				{#if description}
					<div class="description text-md! text-center">
						{@html description}
					</div>
				{/if}
			</div>

			<div class="row gap-3 pt-2">
				<button
					class="btn btn-large grow"
					disabled={loading}
					type="button"
					onclick={() => ref?.close()}
				>
					{$content.cancel}
				</button>
				<button
					type="submit"
					class="btn btn-large grow"
					disabled={loading}
					onclick={submit}
					style:background-color="var(--color-{color})"
					style:color="var(--color-{color}-content)"
					style:border-color="currentColor"
				>
					{$content.confirm}
				</button>
			</div>
		</form>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button></button>
	</form>
</dialog>

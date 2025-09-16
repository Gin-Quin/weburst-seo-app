<script lang="ts">
	import { defineContent } from "$lib/i18n/locale.svelte";

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
		openConfirmDialog?: (input: {
			message: string;
			then: () => unknown;
		}) => void;
	} = $props();

	let ref: HTMLDialogElement | undefined;
	let loading = $state(false);
	let message = $state("");
	let then = $state<() => unknown>(() => {});

	openConfirmDialog = (input) => {
		message = input.message;
		then = input.then;
		ref?.showModal();
	};

	async function submit() {
		loading = true;
		console.log("Submit confirmation", then);
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
			<main class="center bold text-xl text-center">
				{@html message}
			</main>

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
					class="btn btn-error grow"
					disabled={loading}
					onclick={submit}
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

<script lang="ts">
	import { contentStatusLabels } from "$lib/contents/status";
	import type { ContentStatus } from "$lib/server/db/schema";
	import { context } from "$lib/stores/context.svelte";
	import { toast } from "svelte-sonner";
	import { updateStatus } from "../../../../../api/contents/contents.remote";
	let { projectId, id, value, disabled = false, beforeChange, onChanged }: {
		projectId: string; id: string; value: ContentStatus; disabled?: boolean;
		beforeChange?: () => Promise<void>; onChanged?: (status: ContentStatus) => void;
	} = $props();
	let saving = $state(false);
	async function change(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		const status = select.value as ContentStatus;
		saving = true;
		try {
			await beforeChange?.();
			await updateStatus({ projectId, id, status });
			onChanged?.(status);
		} catch (error) {
			select.value = value;
			toast.error(error instanceof Error ? error.message : "Statut non enregistré.");
		} finally { saving = false; }
	}
</script>

<select class="select control-size-1 w-auto min-w-28" aria-label="Statut de l’article" {value}
	disabled={disabled || saving || context.user?.role === "client"}
	onclick={(event) => event.stopPropagation()} onchange={change}>
	{#each Object.entries(contentStatusLabels) as [status, label] (status)}
		<option value={status}>{label}</option>
	{/each}
</select>

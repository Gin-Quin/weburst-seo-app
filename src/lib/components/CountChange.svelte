<script lang="ts">
	let { value, label }: { value: number | undefined; label: string } = $props();
</script>

{#if value !== undefined}
	<span class="badge text-xs whitespace-nowrap" class:badge-success={value > 0}
		class:badge-warning={value < 0} title={label} aria-label={label}>
		{value > 0 ? "+" : ""}{value}
	</span>
{/if}

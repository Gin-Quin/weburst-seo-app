<script lang="ts">
	let { value, label }: { value: number | undefined; label: string } = $props();
</script>

<span class="badge text-xs whitespace-nowrap" class:badge-success={value !== undefined && value > 0}
	class:badge-warning={value !== undefined && value < 0} title={label} aria-label={label}>
	{value === undefined ? "—" : `${value > 0 ? "+" : ""}${value}`}
</span>

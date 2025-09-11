<script lang="ts">
	import { PinInput as InputOTPPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		cell,
		class: className,
		...restProps
	}: InputOTPPrimitive.CellProps = $props();
</script>

<InputOTPPrimitive.Cell
	{cell}
	bind:ref
	data-slot="input-otp-slot"
	class={cn(
		"bg-background border-input aria-invalid:border-destructive dark:bg-input/30 relative flex size-14 items-center justify-center border-y border-r text-md outline-none transition-all first:rounded-l-md first:border-l last:rounded-r-md",
		cell.isActive && "active",
		className,
	)}
	{...restProps}
>
	{cell.char}
	{#if cell.hasFakeCaret}
		<div
			class="pointer-events-none absolute inset-0 flex items-center justify-center"
		>
			<div
				class="animate-caret-blink bg-foreground h-4 w-px duration-1000"
			></div>
		</div>
	{/if}
</InputOTPPrimitive.Cell>

<style>
	:global([data-slot="input-otp"]) {
		overflow: visible;
	}
	:global([data-slot="input-otp-slot"].active) {
		&:after {
			content: "";
			position: absolute;
			inset: -1px;
			border-radius: inherit;
			border: 1px solid var(--color-primary);
			z-index: 10;
			pointer-events: none;
		}
	}
</style>

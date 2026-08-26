<script lang="ts">
	import IconCaretDownRegular from "phosphor-icons-svelte/IconCaretDownRegular.svelte";
	import IconCaretUpRegular from "phosphor-icons-svelte/IconCaretUpRegular.svelte";
	import type { Snippet } from "svelte";

	let {
		class: className = "",
		value = $bindable(),
		name,
		min,
		max,
		disabled = false,
		required = false,
		placeholder,
		leading,
		incrementLabel = "Increment",
		decrementLabel = "Decrement",
	}: {
		class?: string;
		value?: number;
		name?: string;
		min?: number;
		max?: number;
		disabled?: boolean;
		required?: boolean;
		placeholder?: string;
		leading?: Snippet;
		incrementLabel?: string;
		decrementLabel?: string;
	} = $props();

	let input: HTMLInputElement;

	const canIncrement = $derived(
		!disabled && (value === undefined || max === undefined || value < max),
	);
	const canDecrement = $derived(
		!disabled && (value === undefined || min === undefined || value > min),
	);

	function step(direction: 1 | -1) {
		if (direction === 1) {
			input.stepUp();
		} else {
			input.stepDown();
		}

		value = input.valueAsNumber;
		input.focus();
	}
</script>

<div class="integer-input input {className}" class:input-disabled={disabled}>
	{#if leading}
		{@render leading()}
	{/if}

	<input
		bind:this={input}
		bind:value
		{name}
		{min}
		{max}
		{disabled}
		{required}
		{placeholder}
		class="grow"
		type="number"
		step="1"
	/>

	<div class="stepper" aria-hidden={disabled}>
		<button
			type="button"
			class="stepper-button"
			aria-label={incrementLabel}
			disabled={!canIncrement}
			onclick={() => step(1)}
		>
			<IconCaretUpRegular />
		</button>
		<button
			type="button"
			class="stepper-button"
			aria-label={decrementLabel}
			disabled={!canDecrement}
			onclick={() => step(-1)}
		>
			<IconCaretDownRegular />
		</button>
	</div>
</div>

<style>
	.integer-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding-inline-end: 0;
		overflow: hidden;

		&:focus-within {
			border-color: var(--color-primary) !important;
		}

		&.input-disabled {
			cursor: not-allowed;
			opacity: 0.5;
		}
	}

	input {
		min-width: 0;
		appearance: textfield;
		-moz-appearance: textfield;

		&::-webkit-inner-spin-button,
		&::-webkit-outer-spin-button {
			margin: 0;
			appearance: none;
			-webkit-appearance: none;
		}
	}

	.stepper {
		display: grid;
		align-self: stretch;
		flex: 0 0 30px;
		grid-template-rows: repeat(2, minmax(0, 1fr));
		border-left: 1px solid var(--color-border);
	}

	.integer-input.control-size-3 .stepper {
		flex-basis: 40px;
	}

	.integer-input.control-size-3 .stepper-button :global(svg) {
		transform: translateX(-2px);
	}

	.stepper-button {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font-size: 0.75rem;
		cursor: pointer;

		& + & {
			border-top: 1px solid var(--color-border);
		}

		&:hover:not(:disabled),
		&:focus-visible {
			background: var(--color-base-300);
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.3;
		}
	}
</style>

<script lang="ts">
	import IconWarningCircleRegular from "phosphor-icons-svelte/IconWarningCircleRegular.svelte";
	import IconWarningRegular from "phosphor-icons-svelte/IconWarningRegular.svelte";
	import IconCheckCircleRegular from "phosphor-icons-svelte/IconCheckCircleRegular.svelte";
	import IconXRegular from "phosphor-icons-svelte/IconXRegular.svelte";
	import type { Snippet } from "svelte";

	let {
		type,
		title,
		children,
		class: className,
	}: {
		type: "info" | "success" | "warning" | "error";
		title?: string;
		children?: Snippet;
		class?: string;
	} = $props();
</script>

<div
	role="alert"
	class="alert row items-center! py-3 px-3 pr-13 gap-3 bg-base-200 {className}"
>
	<div class="col h-full">
		{#if type === "info"}
			<div class="text-2xl center w-10 h-10 bg-info rounded-full">
				<IconWarningCircleRegular class="text-info" />
			</div>
		{:else if type === "success"}
			<div class="text-2xl center w-10 h-10 bg-success rounded-full">
				<IconCheckCircleRegular class="text-success" />
			</div>
		{:else if type === "warning"}
			<div class="text-2xl center w-10 h-10 bg-warning rounded-full">
				<IconWarningRegular class="text-warning" />
			</div>
		{:else if type === "error"}
			<div class="text-2xl center w-10 h-10 bg-error rounded-full">
				<IconWarningCircleRegular class="text-error" />
			</div>
		{/if}
	</div>

	<div class="col gap-1 grow h-full justify-center">
		{#if title}
			<div class="text-md bold">
				{title}
			</div>
		{/if}

		{#if children}
			<div class="description text-sm">
				{@render children()}
			</div>
		{/if}
	</div>

	<button class="btn alert-close">
		<IconXRegular />
	</button>
</div>

<style>
	.alert {
		width: 28.125rem;
		position: relative;
		box-shadow: 4px 4px 30px 0px rgba(0, 0, 0, 0.15);
		align-items: start;
	}

	.alert-close {
		position: absolute;
		right: 0.75rem;
		top: 0.75rem;
		font-size: 1rem;
		padding: 0;
		width: 2rem;
		height: 2rem;
		border-color: transparent;

		&:hover {
			background-color: var(--color-border);
		}
	}
</style>

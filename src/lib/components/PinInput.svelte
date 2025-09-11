<script lang="ts">
	import { PinInput as InputOTPPrimitive } from "bits-ui";
	import * as InputOTP from "./ui/input-otp";

	let {
		ref = $bindable(null),
		value = $bindable(""),
		...restProps
	}: Omit<InputOTPPrimitive.RootProps, "maxlength"> = $props();
</script>

<InputOTP.Root maxlength={6} bind:value bind:ref {...restProps}>
	{#snippet children({ cells })}
		<InputOTP.Group>
			{#each cells.slice(0, 3) as cell (cell)}
				<InputOTP.Slot {cell} />
			{/each}
		</InputOTP.Group>
		<InputOTP.Separator />
		<InputOTP.Group>
			{#each cells.slice(3, 6) as cell (cell)}
				<InputOTP.Slot {cell} />
			{/each}
		</InputOTP.Group>
	{/snippet}
</InputOTP.Root>

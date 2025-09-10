<script>
	import { page } from "$app/state";
	import { verifyMagicLink } from "../actions.remote";

	const token = page.url.searchParams.get("token");
</script>

{#if !token}
	<div class="col center h-screen">
		<div class="text-center">
			<h1 class="text-4xl font-bold mb-4">Invalid link!</h1>
			<p class="text-gray-600">Please check your email.</p>
		</div>
	</div>
{:else}
	{#await verifyMagicLink(token)}
		<div class="col center h-screen">
			<div class="text-center">
				<h1 class="text-4xl font-bold mb-4">Verifying your email...</h1>
				<p class="text-gray-600">
					Please wait while we verify your email address.
				</p>
			</div>
		</div>
	{:then}
		<div class="col center h-screen">
			<div class="text-center">
				<h1 class="text-4xl font-bold mb-4">Email verified!</h1>
				<p class="text-gray-600">You can now log in.</p>
			</div>
		</div>
	{:catch error}
		<div class="col center h-screen">
			<div class="text-center">
				<h1 class="text-4xl font-bold mb-4">An error occurred!</h1>
				<p class="text-gray-600">Please try again.</p>
			</div>
		</div>
	{/await}
{/if}

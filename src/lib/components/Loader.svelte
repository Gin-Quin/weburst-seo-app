<script lang="ts">
	let { class: className = "w-full h-full" }: { class?: string } = $props();
</script>

<div class="center {className}">
	<!-- <span class="loading loading-spinner text-accent w-8"> </span> -->
	<span class="loading loading-ring w-12 text-accent"></span>
</div>

<script lang="ts">
	import IconDownloadSimple from "phosphor-icons-svelte/IconDownloadSimpleRegular.svelte";
	import IconArrowUpRegular from "phosphor-icons-svelte/IconArrowUpRegular.svelte";
	import IconInfoRegular from "phosphor-icons-svelte/IconInfoRegular.svelte";
	import Alert from "$lib/ui/Alert.svelte";
</script>

<div class="col gap-10 p-10">
	<div class="col gap-2">
		<div class="text-h1 font-bold">Buttons</div>

		<div class="row gap-small">
			<button class="btn">
				<IconDownloadSimple class="icon" />
				Default button
			</button>
			<button class="btn btn-primary">Primary button</button>
			<button class="btn btn-secondary">Secondary button</button>
		</div>
	</div>

	<div class="col gap-2">
		<div class="text-h1 font-bold">Inputs</div>

		<div class="row gap-small">
			<input type="text" class="input" placeholder="Write something" />

			<label class="input">
				<IconDownloadSimple class="icon" />
				<input class="grow" placeholder="Search" />
			</label>
		</div>
	</div>

	<div class="col gap-2">
		<div class="text-h1 font-bold">Select</div>

		<div class="row gap-small">
			<select class="select">
				<option>Choix A</option>
				<option>Choix B</option>
				<option>Choix C</option>
			</select>
		</div>
	</div>

	<div class="col gap-2">
		<div class="text-h1 font-bold">Card</div>

		<div class="card">
			<header>
				<div class="title">Title</div>
				<div class="description">Description</div>
			</header>
			<main>
				<p>Some content here</p>
				<p>The card grows to get all content</p>
			</main>
		</div>
	</div>

	<div class="col gap-2">
		<div class="text-h1 font-bold">Badge</div>

		<div class="row gap-small">
			<div class="badge badge-success">Hello</div>
			<div class="badge badge-info">
				<IconArrowUpRegular class="text-small" />
				Things are getting up
			</div>
			<div class="badge badge-info-magenta">
				<IconArrowUpRegular class="text-small" />
				3%
			</div>
			<div class="badge badge-success">
				<IconArrowUpRegular class="text-small" />
				12%
			</div>
		</div>
	</div>

	<div class="col gap-2">
		<div class="text-h1 font-bold">Checkbox</div>

		<div class="row gap-small">
			<label class="label">
				<input type="checkbox" checked class="checkbox" />
				Remember me
			</label>
		</div>
	</div>

	<div class="col gap-2">
		<div class="text-h1 font-bold">Menu</div>

		<div class="row gap-small">
			<ul class="menu w-56">
				<li><a>Item 1</a></li>
				<li><a class=" menu-active">Item 2</a></li>
				<li><a>Item 3</a></li>
			</ul>
		</div>
	</div>

	<div class="col gap-2">
		<div class="text-h1 font-bold">Alert</div>

		<div class="col gap-small">
			<Alert type="info" title="Title">You received 3 notifications</Alert>
			<Alert type="warning" title="Title">You received 3 notifications</Alert>
			<Alert type="error" title="Title"
				>Saisissez une adresse mail valide pour vous connecter</Alert
			>
			<Alert type="success" title="Title">You received 3 notifications</Alert>
		</div>
	</div>
</div>

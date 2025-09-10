<script lang="ts">
	import type { PageProps } from "./$types";
	import IconSignOutRegular from "phosphor-icons-svelte/IconSignOutRegular.svelte";
	import IconUserRegular from "phosphor-icons-svelte/IconUserRegular.svelte";

	let { data }: PageProps = $props();
</script>

<div class="min-h-screen bg-base-200">
	<div class="navbar bg-base-100 shadow-lg">
		<div class="flex-1">
			<a href="/dashboard" class="btn btn-ghost text-xl">Weburst SEO App</a>
		</div>
		<div class="flex-none gap-2">
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
					<div
						class="w-10 rounded-full bg-primary flex items-center justify-center"
					>
						<IconUserRegular class="text-primary-content" />
					</div>
				</div>
				<ul
					class="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52"
				>
					<li class="menu-title">
						<span>{data.user?.email}</span>
					</li>
					<li>
						<form method="POST" action="/auth/logout">
							<button type="submit" class="w-full text-left">
								<IconSignOutRegular />
								Logout
							</button>
						</form>
					</li>
				</ul>
			</div>
		</div>
	</div>

	<div class="container mx-auto px-4 py-8">
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<h1 class="card-title text-3xl">Welcome to your Dashboard</h1>
				<p class="text-lg">
					Hello, {data.user?.firstName}
					{data.user?.lastName}!
				</p>
				<div class="divider"></div>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Email</div>
						<div class="stat-value text-lg">{data.user?.email}</div>
					</div>
					<div class="stat bg-base-200 rounded-lg">
						<div class="stat-title">Role</div>
						<div class="stat-value text-lg capitalize">{data.user?.role}</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

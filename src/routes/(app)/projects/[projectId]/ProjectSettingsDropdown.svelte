<script lang="ts">
	import { goto } from "$app/navigation";
	import { defineContent } from "$lib/i18n/locale.svelte";
	import { context } from "$lib/stores/context.svelte";
	import IconCaretDownRegular from "phosphor-icons-svelte/IconCaretDownRegular.svelte";
	import IconGearRegular from "phosphor-icons-svelte/IconGearRegular.svelte";
	import IconPencilSimpleRegular from "phosphor-icons-svelte/IconPencilSimpleRegular.svelte";
	import IconTrashRegular from "phosphor-icons-svelte/IconTrashRegular.svelte";
	import { deleteProject } from "../../../api/projects.remote";

	const content = defineContent({
		en: {
			settings: "Settings",
			updateProject: "Update Project",
			deleteProject: "Delete Project",
			confirmDeleteProject: (name: string) =>
				`Are you sure you want to delete the project "${name}"?`,
		},
		fr: {
			settings: "Paramètres",
			updateProject: "Mettre à jour le projet",
			deleteProject: "Supprimer le projet",
			confirmDeleteProject: (name: string) =>
				`Êtes-vous certain de vouloir supprimer le projet "${name}" ?`,
		},
	});
</script>

<div class="dropdown dropdown-bottom dropdown-end z-1">
	<div class="btn center gap-2" tabindex="0" role="button">
		<IconGearRegular class="icon text-accent" />
		{$content.settings}
		<div class="Caret center">
			<IconCaretDownRegular class="text-sm" />
		</div>
	</div>

	<ul
		tabindex="0"
		class="dropdown-content menu bg-base-100 rounded-box w-52 p-2 shadow-sm translate-y-2"
	>
		<li>
			<a onclick={() => context.openProjectDialog?.(context.project)}>
				<IconPencilSimpleRegular class="text-lg" />
				{$content.updateProject}
			</a>
		</li>
		<li>
			<a
				onclick={() =>
					context.openConfirmDialog?.({
						title: $content.confirmDeleteProject(context.project!.domain),
						then: async () => {
							void goto("/");
							void deleteProject(context.project!.id);
						},
					})}
			>
				<IconTrashRegular class="text-lg" />
				{$content.deleteProject}
			</a>
		</li>
	</ul>
</div>

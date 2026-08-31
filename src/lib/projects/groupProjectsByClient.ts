type ProjectWithClient = {
	clientId: string | null;
	clientName: string;
	client?: { name: string } | null;
	domain: string;
};

export type ProjectGroup<T extends ProjectWithClient> = {
	clientId: string | null;
	clientName: string;
	projects: T[];
};

export function groupProjectsByClient<T extends ProjectWithClient>(
	projects: T[],
	currentClientId?: string | null,
): ProjectGroup<T>[] {
	const groups = new Map<string, ProjectGroup<T>>();

	for (const project of projects) {
		const clientName = project.client?.name ?? project.clientName;
		const key = project.clientId ?? `legacy:${clientName}`;
		const group = groups.get(key);

		if (group) {
			group.projects.push(project);
		} else {
			groups.set(key, {
				clientId: project.clientId,
				clientName,
				projects: [project],
			});
		}
	}

	return [...groups.values()]
		.map((group) => ({
			...group,
			projects: group.projects.sort((a, b) =>
				a.domain.localeCompare(b.domain, "fr", { sensitivity: "base" }),
			),
		}))
		.sort((a, b) => {
			if (currentClientId && a.clientId === currentClientId) return -1;
			if (currentClientId && b.clientId === currentClientId) return 1;
			return a.clientName.localeCompare(b.clientName, "fr", { sensitivity: "base" });
		});
}

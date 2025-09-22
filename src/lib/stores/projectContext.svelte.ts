export type ProjectContext = {
	openKeywordsDialog?: () => void;
};

export const projectContext = $state<ProjectContext>({});

export type ProjectToolAvailability = {
	shareOfVoiceEnabled: boolean;
	contentWritingEnabled: boolean;
};

export function getProjectPath(
	projectId: string,
	currentPathname: string,
	tools: ProjectToolAvailability = {
		shareOfVoiceEnabled: true,
		contentWritingEnabled: true,
	},
): string {
	const section = currentPathname.endsWith("/keyword-similarities")
		? "keyword-similarities"
		: currentPathname.endsWith("/contents")
			? "contents"
			: "share-of-voice";
	const sectionIsAvailable =
		section === "contents" ? tools.contentWritingEnabled : tools.shareOfVoiceEnabled;

	if (!sectionIsAvailable) {
		if (tools.shareOfVoiceEnabled) return `/projects/${projectId}/share-of-voice`;
		if (tools.contentWritingEnabled) return `/projects/${projectId}/contents`;
		return "/projects";
	}

	return `/projects/${projectId}/${section}`;
}

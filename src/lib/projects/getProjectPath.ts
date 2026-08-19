export function getProjectPath(projectId: string, currentPathname: string): string {
	const section = currentPathname.endsWith("/keyword-similarities")
		? "keyword-similarities"
		: currentPathname.endsWith("/contents")
			? "contents"
			: "share-of-voice";

	return `/projects/${projectId}/${section}`;
}

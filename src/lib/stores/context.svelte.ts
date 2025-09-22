import type { User } from "$lib/server/db/schema";
import type { ProjectInfo } from "../../routes/api/projects.remote";

export type Context = {
	user: User | null;
	project?: ProjectInfo;
	projects?: ProjectInfo[];
	openProjectDialog?: (project?: ProjectInfo) => void;
	openUserDialog?: (mode?: "account" | "create") => void;
	openConfirmDialog?: (input: {
		title: string;
		description?: string;
		color?: "info" | "success" | "warning" | "error" | "primary" | "secondary" | "accent";
		then: () => unknown;
	}) => void;
};

export const context = $state<Context>({ user: null });

export const setContextUser = (user: User | null) => {
	context.user = user;
	localStorage.setItem("user", JSON.stringify(user));
};

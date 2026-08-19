import type { User } from "$lib/server/db/schema";
import type { ClientInfo } from "../../routes/api/clients.remote";
import type { ProjectInfo } from "../../routes/api/projects.remote";

export type Context = {
	user: User | null;
	clients?: ClientInfo[];
	isArchivingClient: boolean;
	project?: ProjectInfo;
	projects?: ProjectInfo[];
	projectLastOpened: Record<string, number>;
	openProjectDialog?: (project?: ProjectInfo, client?: ClientInfo) => void;
	openUserDialog?: (mode?: "account" | "create") => void;
	openConfirmDialog?: (input: {
		title: string;
		description?: string;
		confirmLabel?: string;
		color?: "info" | "success" | "warning" | "error" | "primary" | "secondary" | "accent";
		then: () => unknown;
	}) => void;
};

export const context = $state<Context>({
	user: null,
	isArchivingClient: false,
	projectLastOpened: {},
});

export const setContextUser = (user: User | null) => {
	context.user = user;
	localStorage.setItem("user", JSON.stringify(user));
};

import { command, getRequestEvent, query } from "$app/server";
import { getMcpApiKeyInfo, revokeMcpApiKey, rotateMcpApiKey } from "$lib/server/mcp/auth";
import { getMcpServerUrl } from "$lib/server/mcp/config";
import { getRequestUser } from "./utilities";

export type McpConnectionInfo = {
	serverUrl: string;
	hasKey: boolean;
	prefix: string | null;
	createdAt: number | null;
	lastUsedAt: number | null;
};

export const getMcpConnectionInfo = query(async (): Promise<McpConnectionInfo> => {
	const user = await getRequestUser();
	if (!user) throw new Error("Unauthorized");
	return {
		serverUrl: getMcpServerUrl(getRequestEvent().url).toString(),
		...(await getMcpApiKeyInfo(user.id)),
	};
});

export const createMcpApiKey = command(async (): Promise<string> => {
	const user = await getRequestUser();
	if (!user) throw new Error("Unauthorized");
	const key = await rotateMcpApiKey(user.id);
	await getMcpConnectionInfo().refresh();
	return key;
});

export const deleteMcpApiKey = command(async (): Promise<void> => {
	const user = await getRequestUser();
	if (!user) throw new Error("Unauthorized");
	await revokeMcpApiKey(user.id);
	await getMcpConnectionInfo().refresh();
});

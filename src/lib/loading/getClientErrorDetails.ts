/** Browser diagnostics contain references, never upstream messages, causes or stacks. */
export function getClientErrorDetails(error: unknown) {
	const details: { name: string; status?: number; errorId?: string } = { name: "Error" };
	if (!error || typeof error !== "object") return details;
	if (
		"name" in error &&
		["Error", "TypeError", "TimeoutError", "AbortError"].includes(String(error.name))
	) {
		details.name = String(error.name);
	}
	if ("status" in error && typeof error.status === "number") details.status = error.status;
	const body = "body" in error && error.body && typeof error.body === "object" ? error.body : error;
	if (
		"errorId" in body &&
		typeof body.errorId === "string" &&
		/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(body.errorId)
	) {
		details.errorId = body.errorId;
	}
	return details;
}

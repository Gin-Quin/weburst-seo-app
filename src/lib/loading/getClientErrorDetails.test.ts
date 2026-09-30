import { expect, test } from "bun:test";
import { getClientErrorDetails } from "./getClientErrorDetails";

test("omits upstream messages, stacks, causes and custom names from browser logs", () => {
	const error = new Error("DataForSEO task failed", { cause: "https://api.dataforseo.com" });
	error.name = "DataForSEOError";
	expect(getClientErrorDetails(error)).toEqual({ name: "Error" });
	expect(getClientErrorDetails("DataForSEO unavailable")).toEqual({ name: "Error" });
	expect(getClientErrorDetails(null)).toEqual({ name: "Error" });
});

test("keeps the status and server reference from remote failures", () => {
	const errorId = "a8802524-0c7f-4179-a2e3-aaaa628ae159";
	expect(
		getClientErrorDetails({ status: 500, body: { message: "DataForSEO unavailable", errorId } }),
	).toEqual({ name: "Error", status: 500, errorId });
	expect(getClientErrorDetails({ name: "TimeoutError", errorId: "DataForSEO" })).toEqual({
		name: "TimeoutError",
	});
});

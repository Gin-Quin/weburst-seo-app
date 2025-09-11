import type { User } from "$lib/server/db/schema";

export type Context =
	| {
			user: User;
	  }
	| {
			user: null;
	  };

export const context = $state<Context>({ user: null });

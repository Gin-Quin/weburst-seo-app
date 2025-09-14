import type { User } from "$lib/server/db/schema";

export type Context =
	| {
			user: User;
	  }
	| {
			user: null;
	  };

export const context = $state<Context>({ user: null });

export const setContextUser = (user: User | null) => {
	context.user = user;
	localStorage.setItem("user", JSON.stringify(user));
};

import type { QueryConfig } from "$lib/server/db";

export const userIncludes = {
	columns: {
		id: true,
		name: true
	}
} as const satisfies QueryConfig<"user">;

export const logIncludes = {
	dm: true,
	magicItemsGained: true,
	magicItemsLost: true,
	storyAwardsGained: true,
	storyAwardsLost: true
} as const satisfies QueryConfig<"logs">["with"];

export const characterIncludes = (includeLogs = true) =>
	({
		user: userIncludes,
		logs: {
			with: logIncludes,
			orderBy: {
				date: "asc"
			},
			limit: includeLogs ? undefined : 0
		}
	}) as const satisfies QueryConfig<"characters">["with"];

export const extendedLogIncludes = {
	...logIncludes,
	character: {
		with: {
			user: userIncludes
		}
	}
} as const satisfies QueryConfig<"logs">["with"];

export const userDMLogIncludes = {
	with: {
		character: {
			columns: {
				id: true,
				name: true,
				userId: true
			}
		}
	}
} as const satisfies QueryConfig<"logs">;

import type { QueryConfig } from "$server/db";

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

export const characterIncludes = {
	user: userIncludes
} as const satisfies QueryConfig<"characters">["with"];

export const extendedLogIncludes = {
	...logIncludes,
	character: {
		with: characterIncludes
	}
} as const satisfies QueryConfig<"logs">["with"];

export const extendedCharacterIncludes = {
	...characterIncludes,
	logs: {
		with: logIncludes,
		orderBy: {
			date: "asc"
		}
	}
} as const satisfies QueryConfig<"characters">["with"];

export const userDMIncludes = {
	logs: {
		with: {
			character: {
				columns: {
					id: true,
					name: true,
					userId: true
				}
			}
		}
	}
} as const satisfies QueryConfig<"dungeonMasters">["with"];

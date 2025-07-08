import type { DungeonMasterId, LocalsUser, UserId } from "$lib/schemas";
import { createUserDM } from "$server/actions/dms";
import { type InferQueryResult } from "$server/db";
import { DBService, FetchError } from "$server/db/effect";
import type { DungeonMaster } from "$server/db/schema";
import { sorter } from "@sillvva/utils";
import { Effect } from "effect";

class FetchDMError extends FetchError {}
function createDMError(err: unknown): FetchDMError {
	return FetchDMError.from(err);
}

export type UserDMs = InferQueryResult<
	"dungeonMasters",
	{
		with: {
			logs: {
				with: {
					character: {
						columns: {
							id: true;
							name: true;
							userId: true;
						};
					};
				};
			};
		};
	}
>[];

export function getUserDMs(
	user: LocalsUser,
	{ id, includeLogs = true }: { id?: DungeonMasterId; includeLogs?: boolean } = {}
): Effect.Effect<UserDMs, FetchDMError, DBService> {
	return Effect.gen(function* () {
		if (!user || !user.id) return [];

		const Database = yield* DBService;
		const db = yield* Database.db;

		return yield* Effect.tryPromise({
			try: async () => {
				return db.query.dungeonMasters.findMany({
					with: includeLogs
						? {
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
							}
						: undefined,
					where: {
						id: id
							? {
									eq: id
								}
							: undefined,
						userId: {
							eq: user.id
						}
					}
				});
			},
			catch: createDMError
		}).pipe(
			// Add empty logs to each DM, if includeLogs is false
			Effect.map((dms) => dms.map((d) => ({ logs: [] as UserDMs[number]["logs"], ...d }))),
			// Sort the DMs by isUser and name
			Effect.map((dms) => dms.toSorted((a, b) => sorter(a.isUser, b.isUser) || sorter(a.name, b.name))),
			// Add the user DM if there isn't one already, and not searching for a specific DM
			Effect.flatMap((dms) => (!id && !dms[0]?.isUser ? addUserDM(user, dms) : Effect.succeed(dms)))
		);
	});
}

function addUserDM(user: LocalsUser, dms: UserDMs) {
	return Effect.gen(function* () {
		const result = yield* createUserDM(user).pipe(Effect.catchAll(createDMError));
		return dms.toSpliced(0, 0, {
			...result,
			logs: [] as UserDMs[number]["logs"]
		});
	});
}

export function getFuzzyDM(userId: UserId, isUser: boolean, dm: DungeonMaster) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		return yield* Effect.tryPromise({
			try: () =>
				db.query.dungeonMasters.findFirst({
					where: {
						userId: {
							eq: userId
						},
						...(isUser
							? { isUser }
							: {
									name: dm.name.trim() || undefined,
									DCI: dm.DCI || undefined
								})
					}
				}),
			catch: createDMError
		});
	});
}

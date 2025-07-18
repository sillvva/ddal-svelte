import type { DungeonMasterId, DungeonMasterSchema, LocalsUser, UserId } from "$lib/schemas";
import { buildConflictUpdateColumns, type Database, type InferQueryResult, type Transaction } from "$server/db";
import { dungeonMasters, type DungeonMaster } from "$server/db/schema";
import { sorter } from "@sillvva/utils";
import { and, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";
import { DBService, debugSet, FetchError, FormError, Log } from ".";

export class FetchDMError extends FetchError {}
function createFetchError(err: unknown): FetchDMError {
	return FetchDMError.from(err);
}

export class SaveDMError extends FormError<DungeonMasterSchema> {}
function createSaveError(err: unknown): SaveDMError {
	return SaveDMError.from(err);
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

interface DMApiImpl {
	readonly db: Database | Transaction;
	readonly get: {
		readonly userDMs: (
			user: LocalsUser,
			{ id, includeLogs }: { id?: DungeonMasterId; includeLogs?: boolean }
		) => Effect.Effect<UserDMs, FetchDMError>;
		readonly fuzzyDM: (
			userId: UserId,
			isUser: boolean,
			dm: DungeonMaster
		) => Effect.Effect<DungeonMaster | undefined, FetchDMError>;
	};
	readonly set: {
		readonly save: (
			dmId: DungeonMasterId,
			user: LocalsUser,
			data: DungeonMasterSchema
		) => Effect.Effect<DungeonMaster, SaveDMError>;
		readonly addUserDM: (user: LocalsUser, dm: UserDMs) => Effect.Effect<UserDMs, SaveDMError>;
		readonly delete: (dm: UserDMs[number], userId: UserId) => Effect.Effect<{ id: DungeonMasterId }, SaveDMError>;
	};
}

export class DMService extends Effect.Service<DMService>()("DMSService", {
	effect: Effect.gen(function* () {
		const { db } = yield* DBService;

		const impl: DMApiImpl = {
			db,
			get: {
				userDMs: (user, { id, includeLogs = true } = {}) =>
					Effect.gen(function* () {
						yield* Log.info("DMApiLive.getUserDMs", { userId: user.id, id, includeLogs });

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
							catch: createFetchError
						}).pipe(
							// Add empty logs to each DM, if includeLogs is false
							Effect.map((dms) => dms.map((d) => ({ logs: [] as UserDMs[number]["logs"], ...d }))),
							// Sort the DMs by isUser and name
							Effect.map((dms) => dms.toSorted((a, b) => sorter(a.isUser, b.isUser) || sorter(a.name, b.name))),
							// Add the user DM if there isn't one already, and not searching for a specific DM
							Effect.flatMap((dms) =>
								!id && !dms[0]?.isUser
									? impl.set.addUserDM(user, dms).pipe(Effect.catchAll(createFetchError))
									: Effect.succeed(dms)
							)
						);
					}),

				fuzzyDM: (userId, isUser, dm) =>
					Effect.gen(function* () {
						yield* Log.info("DMApiLive.getFuzzyDM", {
							userId,
							...(isUser ? { isUser } : { name: dm.name.trim() || undefined, DCI: dm.DCI || undefined })
						});

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
							catch: createFetchError
						});
					})
			},
			set: {
				save: (dmId, user, data) =>
					Effect.gen(function* () {
						yield* Log.info("DMApiLive.saveDM", { dmId, userId: user.id });
						yield* Log.debug("DMApiLive.saveDM", data);

						const [dm] = yield* impl.get.userDMs(user, { id: dmId }).pipe(Effect.catchAll(createSaveError));
						if (!dm) return yield* new SaveDMError("DM does not exist", { status: 404 });

						if (!data.name.trim()) {
							if (dm.isUser) data.name = user.name;
							else return yield* new SaveDMError("Name is required", { status: 400, field: "name" });
						}

						return yield* Effect.tryPromise({
							try: () =>
								db
									.update(dungeonMasters)
									.set({
										name: data.name,
										DCI: data.DCI || null
									})
									.where(eq(dungeonMasters.id, dmId))
									.returning(),
							catch: createSaveError
						}).pipe(
							Effect.flatMap((dms) =>
								isTupleOf(dms, 1) ? Effect.succeed(dms[0]) : Effect.fail(new SaveDMError("Failed to save DM"))
							)
						);
					}),

				addUserDM: (user, dms) =>
					Effect.gen(function* () {
						yield* Log.info("DMApiLive.addUserDM", { userId: user.id });

						const result = yield* Effect.tryPromise({
							try: () =>
								db
									.insert(dungeonMasters)
									.values({
										name: user.name,
										DCI: null,
										userId: user.id,
										isUser: true
									})
									.onConflictDoUpdate({
										target: [dungeonMasters.userId, dungeonMasters.isUser],
										set: buildConflictUpdateColumns(dungeonMasters, ["name"])
									})
									.returning(),
							catch: createSaveError
						}).pipe(
							Effect.flatMap((dms) =>
								isTupleOf(dms, 1)
									? Effect.succeed({ ...dms[0], logs: [] as UserDMs[number]["logs"] })
									: Effect.fail(new SaveDMError("Failed to create DM"))
							)
						);

						return dms.toSpliced(0, 0, result);
					}),

				delete: (dm, userId) =>
					Effect.gen(function* () {
						yield* Log.info("DMApiLive.deleteDM", { dmId: dm.id, userId });

						if (dm.logs.length) return yield* new SaveDMError("You cannot delete a DM that has logs", { status: 400 });

						return yield* Effect.tryPromise({
							try: () =>
								db
									.delete(dungeonMasters)
									.where(and(eq(dungeonMasters.id, dm.id), eq(dungeonMasters.userId, userId)))
									.returning({ id: dungeonMasters.id }),
							catch: createSaveError
						}).pipe(
							Effect.flatMap((result) =>
								isTupleOf(result, 1) ? Effect.succeed(result[0]) : Effect.fail(new SaveDMError("DM not found", { status: 404 }))
							)
						);
					})
			}
		};

		return impl;
	}),
	dependencies: [DBService.Default()]
}) {}

export const DMTx = (tx: Transaction) => DMService.DefaultWithoutDependencies.pipe(Layer.provide(DBService.Default(tx)));

export function withDM<R, E extends FetchDMError | SaveDMError>(impl: (service: DMApiImpl) => Effect.Effect<R, E>) {
	return Effect.gen(function* () {
		const dmApi = yield* DMService;
		const result = yield* impl(dmApi);

		yield* debugSet("DMService", impl, result);

		return result;
	}).pipe(Effect.provide(DMService.Default));
}

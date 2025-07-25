import type { DungeonMasterId, DungeonMasterSchema, LocalsUser, UserId } from "$lib/schemas";
import { DBService, type Database, type InferQueryResult, type Transaction } from "$server/db";
import { userDMIncludes } from "$server/db/includes";
import { dungeonMasters, type DungeonMaster } from "$server/db/schema";
import { sorter } from "@sillvva/utils";
import { and, eq } from "drizzle-orm";
import { Data, Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";
import { debugSet, FormError, Log, type ErrorParams } from ".";

class FetchUserDMsError extends Data.TaggedError("FetchUserDMsError")<ErrorParams> {
	constructor(params: Omit<ErrorParams, "_tag"> = { message: "Unable to fetch user DMs", status: 500 }) {
		super(params);
	}
}

export class DMNotFoundError extends Data.TaggedError("DMNotFoundError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "DM not found", status: 404, cause: err });
	}
}

export class SaveDMError extends FormError<DungeonMasterSchema> {}
function createSaveError(err: unknown): SaveDMError {
	return SaveDMError.from(err);
}

export type UserDM = InferQueryResult<"dungeonMasters", { with: typeof userDMIncludes }>;

interface DMApiImpl {
	readonly db: Database | Transaction;
	readonly get: {
		readonly userDMs: (
			user: LocalsUser,
			{ id, includeLogs }: { id?: DungeonMasterId; includeLogs?: boolean }
		) => Effect.Effect<UserDM[], FetchUserDMsError>;
		readonly fuzzyDM: (
			userId: UserId,
			isUser: boolean,
			dm: Pick<DungeonMaster, "name" | "DCI">
		) => Effect.Effect<DungeonMaster | undefined>;
	};
	readonly set: {
		readonly save: (
			dmId: DungeonMasterId,
			user: LocalsUser,
			data: DungeonMasterSchema
		) => Effect.Effect<DungeonMaster, SaveDMError>;
		readonly addUserDM: (user: LocalsUser, dm: UserDM[]) => Effect.Effect<UserDM[], SaveDMError>;
		readonly delete: (dm: UserDM, userId: UserId) => Effect.Effect<{ id: DungeonMasterId }, SaveDMError>;
	};
}

export class DMService extends Effect.Service<DMService>()("DMSService", {
	effect: Effect.fn("DMService")(function* () {
		const { db } = yield* DBService;

		const impl: DMApiImpl = {
			db,
			get: {
				userDMs: Effect.fn("DMService.getUserDMs")(function* (user, { id, includeLogs = true } = {}) {
					yield* Log.info("DMService.getUserDMs", { userId: user.id, id, includeLogs });

					return yield* Effect.promise(() =>
						db.query.dungeonMasters.findMany({
							with: includeLogs ? userDMIncludes : undefined,
							where: {
								id: id ? { eq: id } : undefined,
								userId: { eq: user.id }
							}
						})
					).pipe(
						// Add empty logs to each DM, if includeLogs is false
						Effect.map((dms) => dms.map((d) => ({ logs: [] as UserDM["logs"], ...d }))),
						// Sort the DMs by isUser and name
						Effect.map((dms) => dms.toSorted((a, b) => sorter(a.isUser, b.isUser) || sorter(a.name, b.name))),
						// Add the user DM if there isn't one already, and not searching for a specific DM
						Effect.flatMap((dms) =>
							!id && !dms[0]?.isUser
								? impl.set.addUserDM(user, dms).pipe(Effect.catchAll((e) => new FetchUserDMsError({ ...e, cause: e })))
								: Effect.succeed(dms)
						)
					);
				}),

				fuzzyDM: Effect.fn("DMService.getFuzzyDM")(function* (userId, isUser, dm) {
					yield* Log.info("DMService.getFuzzyDM", {
						userId,
						...(isUser ? { isUser } : { name: dm.name.trim() || undefined, DCI: dm.DCI || undefined })
					});

					return yield* Effect.promise(() =>
						db.query.dungeonMasters.findFirst({
							where: {
								userId: { eq: userId },
								...(isUser
									? { isUser }
									: {
											name: dm.name.trim() || undefined,
											DCI: dm.DCI || undefined
										})
							}
						})
					);
				})
			},
			set: {
				save: Effect.fn("DMService.saveDM")(function* (dmId, user, data) {
					yield* Log.info("DMService.saveDM", { dmId, userId: user.id });
					yield* Log.debug("DMService.saveDM", data);

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

				addUserDM: Effect.fn("DMService.addUserDM")(function* (user, dms) {
					yield* Log.info("DMService.addUserDM", { userId: user.id });

					const existing = yield* Effect.promise(() =>
						db.query.dungeonMasters.findFirst({
							where: {
								userId: { eq: user.id },
								isUser: true
							}
						})
					);

					const result = yield* Effect.tryPromise({
						try: () =>
							existing
								? db.update(dungeonMasters).set({ name: user.name }).where(eq(dungeonMasters.id, existing.id)).returning()
								: db.insert(dungeonMasters).values({ name: user.name, userId: user.id, isUser: true }).returning(),
						catch: createSaveError
					}).pipe(
						Effect.flatMap((dms) =>
							isTupleOf(dms, 1)
								? Effect.succeed({ ...dms[0], logs: [] as UserDM["logs"] })
								: Effect.fail(new SaveDMError("Failed to create DM"))
						)
					);

					return dms.toSpliced(0, 0, result);
				}),

				delete: Effect.fn("DMService.deleteDM")(function* (dm, userId) {
					yield* Log.info("DMService.deleteDM", { dmId: dm.id, userId });

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

export const DMTx = (tx: Transaction) => DMService.DefaultWithoutDependencies().pipe(Layer.provide(DBService.Default(tx)));

export const withDM = Effect.fn("withDM")(
	function* <R, E extends FetchUserDMsError | SaveDMError>(impl: (service: DMApiImpl) => Effect.Effect<R, E>) {
		const dmApi = yield* DMService;
		const result = yield* impl(dmApi);

		yield* debugSet("DMService", impl, result);

		return result;
	},
	(effect) => effect.pipe(Effect.provide(DMService.Default()))
);

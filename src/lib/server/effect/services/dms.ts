import type { DungeonMasterId, DungeonMasterSchema, LocalsUser, UserId } from "$lib/schemas";
import { DBService, runQuery, type Database, type DrizzleError, type InferQueryResult, type Transaction } from "$lib/server/db";
import { userDMLogIncludes } from "$lib/server/db/includes";
import { dungeonMasters, type DungeonMaster } from "$lib/server/db/schema";
import type { ErrorParams } from "$lib/server/effect/errors";
import { FormError } from "$lib/server/effect/forms";
import { AppLog } from "$lib/server/effect/logging";
import { assertAuthOrFail, UnauthorizedError } from "$lib/server/effect/services/auth";
import { sorter } from "@sillvva/utils";
import { and, eq } from "drizzle-orm";
import { Data, Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";

class FetchUserDMsError extends Data.TaggedError("FetchUserDMsError")<ErrorParams> {
	constructor(params: ErrorParams = { message: "Unable to fetch user DMs", status: 500 }) {
		super(params);
	}
}

export class DMNotFoundError extends Data.TaggedError("DMNotFoundError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "DM not found", status: 404, cause: err });
	}
}

export class SaveDMError extends FormError<DungeonMasterSchema> {}
export class DeleteDMError extends FormError<{ id: DungeonMasterId }> {}

export type UserDM = InferQueryResult<"dungeonMasters", { with: { logs: typeof userDMLogIncludes } }>;

interface DMApiImpl {
	readonly db: Database | Transaction;
	readonly get: {
		readonly userDMs: (
			userId: UserId,
			options?: { id?: DungeonMasterId; includeLogs?: boolean }
		) => Effect.Effect<UserDM[], FetchUserDMsError | DrizzleError>;
		readonly fuzzyDM: (
			userId: UserId,
			isUser: boolean,
			dm: Pick<DungeonMaster, "name" | "DCI">
		) => Effect.Effect<DungeonMaster | undefined, DrizzleError>;
	};
	readonly set: {
		readonly save: (
			dmId: DungeonMasterId,
			user: LocalsUser,
			data: DungeonMasterSchema
		) => Effect.Effect<DungeonMaster, SaveDMError | DrizzleError>;
		readonly addUserDM: (dms: UserDM[]) => Effect.Effect<UserDM[], SaveDMError | DrizzleError | UnauthorizedError>;
		readonly delete: (dm: UserDM, userId: UserId) => Effect.Effect<{ id: DungeonMasterId }, DeleteDMError | DrizzleError>;
	};
}

export class DMService extends Effect.Service<DMService>()("DMSService", {
	effect: Effect.fn("DMService")(function* () {
		const { db } = yield* DBService;

		const impl: DMApiImpl = {
			db,
			get: {
				userDMs: Effect.fn("DMService.get.userDMs")(function* (userId, { id, includeLogs = true } = {}) {
					return yield* runQuery(
						db.query.dungeonMasters.findMany({
							with: {
								logs: {
									...userDMLogIncludes,
									limit: includeLogs ? undefined : 0
								}
							},
							where: {
								id: id ? { eq: id } : undefined,
								userId: { eq: userId }
							}
						})
					).pipe(
						// Sort the DMs by isUser and name
						Effect.map((dms) => dms.toSorted((a, b) => sorter(a.isUser, b.isUser) || sorter(a.name, b.name))),
						// Add the user DM if there isn't one already, and not searching for a specific DM
						Effect.flatMap((dms) =>
							!id && !dms[0]?.isUser
								? impl.set.addUserDM(dms).pipe(Effect.catchAll((e) => new FetchUserDMsError({ ...e, cause: e })))
								: Effect.succeed(dms)
						),
						Effect.tapError(() => AppLog.debug("DMService.get.userDMs", { userId, id, includeLogs }))
					);
				}),

				fuzzyDM: Effect.fn("DMService.get.fuzzyDM")(function* (userId, isUser, dm) {
					return yield* runQuery(
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
					).pipe(
						Effect.tapError(() =>
							AppLog.debug("DMService.get.fuzzyDM", {
								userId,
								...(isUser ? { isUser } : { name: dm.name.trim() || undefined, DCI: dm.DCI || undefined })
							})
						)
					);
				})
			},
			set: {
				save: Effect.fn("DMService.set.save")(function* (dmId, user, data) {
					const [dm] = yield* impl.get
						.userDMs(user.id, { id: dmId })
						.pipe(Effect.catchTag("FetchUserDMsError", (err) => new SaveDMError(err.message)));
					if (!dm) return yield* new SaveDMError("DM does not exist", { status: 404 });

					if (!data.name.trim()) {
						if (dm.isUser) data.name = user.name;
						else return yield* new SaveDMError("Name is required", { status: 400, field: "name" });
					}

					return yield* runQuery(
						db
							.update(dungeonMasters)
							.set({
								name: data.name,
								DCI: data.DCI || null
							})
							.where(eq(dungeonMasters.id, dmId))
							.returning()
					).pipe(
						Effect.flatMap((dms) =>
							isTupleOf(dms, 1) ? Effect.succeed(dms[0]) : Effect.fail(new SaveDMError("Failed to save DM"))
						),
						Effect.tap((result) => AppLog.info("DMService.set.save", { dmId, userId: user.id, result })),
						Effect.tapError(() => AppLog.debug("DMService.set.save", { dmId, userId: user.id, data }))
					);
				}),

				addUserDM: Effect.fn("DMService.set.addUserDM")(function* (dms) {
					const user = yield* assertAuthOrFail();

					const existing = yield* runQuery(
						db.query.dungeonMasters.findFirst({
							where: {
								userId: { eq: user.id },
								isUser: true
							}
						})
					);

					const result = yield* runQuery(
						existing
							? db.update(dungeonMasters).set({ name: user.name }).where(eq(dungeonMasters.id, existing.id)).returning()
							: db.insert(dungeonMasters).values({ name: user.name, userId: user.id, isUser: true }).returning()
					).pipe(
						Effect.flatMap((dms) =>
							isTupleOf(dms, 1)
								? Effect.succeed({ ...dms[0], logs: [] as UserDM["logs"] })
								: Effect.fail(new SaveDMError("Failed to create DM"))
						),
						Effect.tap((result) => AppLog.info("DMService.set.addUserDM", { result }))
					);

					return dms.toSpliced(0, 0, result);
				}),

				delete: Effect.fn("DMService.set.delete")(function* (dm, userId) {
					if (dm.logs.length) return yield* new DeleteDMError("You cannot delete a DM that has logs", { status: 400 });

					return yield* runQuery(
						db
							.delete(dungeonMasters)
							.where(and(eq(dungeonMasters.id, dm.id), eq(dungeonMasters.userId, userId)))
							.returning({ id: dungeonMasters.id })
					).pipe(
						Effect.flatMap((result) =>
							isTupleOf(result, 1) ? Effect.succeed(result[0]) : Effect.fail(new DeleteDMError("Unable to delete DM"))
						),
						Effect.tap((result) => AppLog.info("DMService.set.delete", { dmId: dm.id, userId, result })),
						Effect.tapError(() => AppLog.debug("DMService.set.delete", { dmId: dm.id, userId }))
					);
				})
			}
		};

		return impl;
	}),
	dependencies: [DBService.Default()]
}) {}

export const DMTx = (tx: Transaction) => DMService.DefaultWithoutDependencies().pipe(Layer.provide(DBService.Default(tx)));

import type { DungeonMasterId, DungeonMasterSchema, LocalsUser, UserId } from "$lib/schemas";
import { DBService, runQuery, type DrizzleError, type InferQueryResult, type Transaction } from "$lib/server/db";
import { userDMLogIncludes } from "$lib/server/db/includes";
import { dungeonMasters, type DungeonMaster } from "$lib/server/db/schema";
import type { ErrorParams } from "$lib/server/effect/errors";
import { FormError } from "$lib/server/effect/errors";
import { AppLog } from "$lib/server/effect/logging";
import { sorter } from "@sillvva/utils";
import { and, eq } from "drizzle-orm";
import { Data, Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";

export class DMNotFoundError extends Data.TaggedError("DMNotFoundError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "DM not found", status: 404, cause: err });
	}
}

export class SaveDMError extends FormError<DungeonMasterSchema> {}
export class DeleteDMError extends FormError<{ id: DungeonMasterId }> {}

export type UserDM = InferQueryResult<"dungeonMasters", { with: { logs: typeof userDMLogIncludes } }>;

interface DMApiImpl {
	readonly get: {
		readonly one: (
			dmId: DungeonMasterId,
			userId: UserId,
			includeLogs?: boolean
		) => Effect.Effect<UserDM, DMNotFoundError | DrizzleError>;
		readonly all: (user: LocalsUser, includeLogs?: boolean) => Effect.Effect<UserDM[], SaveDMError | DrizzleError>;
		readonly fuzzySearch: (
			userId: UserId,
			isUser: boolean,
			dm: Pick<DungeonMaster, "name" | "DCI">
		) => Effect.Effect<DungeonMaster | undefined, DrizzleError>;
	};
	readonly set: {
		readonly save: (user: LocalsUser, data: DungeonMasterSchema) => Effect.Effect<DungeonMaster, SaveDMError | DrizzleError>;
		readonly addUserDM: (user: LocalsUser, dms: UserDM[]) => Effect.Effect<UserDM[], SaveDMError | DrizzleError>;
		readonly delete: (dm: UserDM, userId: UserId) => Effect.Effect<{ id: DungeonMasterId }, DeleteDMError | DrizzleError>;
	};
}

export class DMService extends Effect.Service<DMService>()("DMSService", {
	effect: Effect.fn("DMService")(function* () {
		const { db } = yield* DBService;

		const impl: DMApiImpl = {
			get: {
				one: Effect.fn("DMService.get.one")(function* (dmId, userId, includeLogs = true) {
					return yield* runQuery(
						db.query.dungeonMasters.findFirst({
							with: {
								logs: {
									...userDMLogIncludes,
									limit: includeLogs ? undefined : 0
								}
							},
							where: {
								id: { eq: dmId },
								userId: { eq: userId }
							}
						})
					).pipe(
						Effect.flatMap((dm) => (dm ? Effect.succeed(dm) : Effect.fail(new DMNotFoundError()))),
						Effect.tapError(() => AppLog.debug("DMService.get.one", { dmId, userId, includeLogs }))
					);
				}),

				all: Effect.fn("DMService.get.all")(function* (user, includeLogs = true) {
					return yield* runQuery(
						db.query.dungeonMasters.findMany({
							with: {
								logs: {
									...userDMLogIncludes,
									limit: includeLogs ? undefined : 0
								}
							},
							where: {
								userId: { eq: user.id }
							}
						})
					).pipe(
						// Sort the DMs by isUser and name
						Effect.map((dms) => dms.toSorted((a, b) => sorter(a.isUser, b.isUser) || sorter(a.name, b.name))),
						// Add the user DM if there isn't one already
						Effect.flatMap((dms) => (!dms[0]?.isUser ? impl.set.addUserDM(user, dms) : Effect.succeed(dms))),
						Effect.tapError(() => AppLog.debug("DMService.get.all", { userId: user.id, includeLogs }))
					);
				}),

				fuzzySearch: Effect.fn("DMService.get.fuzzySearch")(function* (userId, isUser, dm) {
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
							AppLog.debug("DMService.get.fuzzySearch", {
								userId,
								...(isUser ? { isUser } : { name: dm.name.trim() || undefined, DCI: dm.DCI || undefined })
							})
						)
					);
				})
			},
			set: {
				save: Effect.fn("DMService.set.save")(function* (user, data) {
					const dm = yield* impl.get.one(data.id, user.id).pipe(Effect.catchAll((err) => new SaveDMError(err.message)));

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
							.where(eq(dungeonMasters.id, data.id))
							.returning()
					).pipe(
						Effect.flatMap((dms) =>
							isTupleOf(dms, 1) ? Effect.succeed(dms[0]) : Effect.fail(new SaveDMError("Failed to save DM"))
						),
						Effect.tap((result) => AppLog.info("DMService.set.save", { userId: user.id, result })),
						Effect.tapError(() => AppLog.debug("DMService.set.save", { userId: user.id, data }))
					);
				}),

				addUserDM: Effect.fn("DMService.set.addUserDM")(function* (user, dms) {
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

import type { DungeonMasterId, DungeonMasterSchema, LocalsUser, UserId } from "$lib/schemas";
import { buildConflictUpdateColumns, db, type Database, type InferQueryResult, type Transaction } from "$server/db";
import { dungeonMasters, type DungeonMaster } from "$server/db/schema";
import { sorter } from "@sillvva/utils";
import { eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { DBService, FetchError, FormError, withLiveDB } from ".";

class FetchDMError extends FetchError {}
function createFetchError(err: unknown): FetchDMError {
	return FetchDMError.from(err);
}

class SaveDMError extends FormError<DungeonMasterSchema> {}
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

interface FetchDMApiImpl {
	readonly getUserDMs: (
		user: LocalsUser,
		{ id, includeLogs }: { id?: DungeonMasterId; includeLogs?: boolean }
	) => Effect.Effect<UserDMs, FetchDMError>;
	readonly getFuzzyDM: (
		userId: UserId,
		isUser: boolean,
		dm: DungeonMaster
	) => Effect.Effect<DungeonMaster | undefined, FetchDMError>;
}

interface SaveDMApiImpl {
	readonly saveDM: (
		dmId: DungeonMasterId,
		user: LocalsUser,
		data: DungeonMasterSchema
	) => Effect.Effect<DungeonMaster[], SaveDMError>;
	readonly deleteDM: (dm: UserDMs[number]) => Effect.Effect<
		{
			id: DungeonMasterId;
		}[],
		SaveDMError
	>;
}

export class FetchDMApi extends Context.Tag("FetchDMApi")<FetchDMApi, FetchDMApiImpl>() {}
export class SaveDMApi extends Context.Tag("SaveDMApi")<SaveDMApi, SaveDMApiImpl>() {}

function addUserDM(user: LocalsUser, dms: UserDMs, dbOrTx: Database | Transaction = db) {
	return Effect.gen(function* () {
		const result = yield* Effect.tryPromise({
			try: () =>
				dbOrTx
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
			Effect.map((dms) => dms[0]),
			Effect.flatMap((dm) => (dm ? Effect.succeed(dm) : Effect.fail(new SaveDMError("Failed to create DM"))))
		);
		return dms.toSpliced(0, 0, {
			...result,
			logs: [] as UserDMs[number]["logs"]
		});
	});
}

const FetchDMApiLive = Layer.effect(
	FetchDMApi,
	Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		return {
			getUserDMs: (user, { id, includeLogs = true } = {}) =>
				Effect.tryPromise({
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
						!id && !dms[0]?.isUser ? addUserDM(user, dms).pipe(Effect.catchAll(createFetchError)) : Effect.succeed(dms)
					)
				),
			getFuzzyDM: (userId, isUser, dm) =>
				Effect.tryPromise({
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
				})
		};
	})
);

const SaveDMApiLive = Layer.effect(
	SaveDMApi,
	Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		return {
			saveDM: (dmId, user, data) =>
				Effect.gen(function* () {
					const FetchDMService = yield* FetchDMApi;
					const [dm] = yield* FetchDMService.getUserDMs(user, { id: dmId }).pipe(Effect.catchAll(createSaveError));
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
					}).pipe(Effect.flatMap((c) => (c ? Effect.succeed(c) : Effect.fail(new SaveDMError("Failed to save DM")))));
				}).pipe(Effect.provide(FetchDMLive())),
			deleteDM: (dm) =>
				Effect.gen(function* () {
					if (dm.logs.length) return yield* new SaveDMError("You cannot delete a DM that has logs", { status: 400 });

					return yield* Effect.tryPromise({
						try: () => db.delete(dungeonMasters).where(eq(dungeonMasters.id, dm.id)).returning({ id: dungeonMasters.id }),
						catch: createSaveError
					}).pipe(
						Effect.flatMap((result) => (result ? Effect.succeed(result) : Effect.fail(new SaveDMError("Failed to delete DM"))))
					);
				})
		};
	})
);

const DMApiLive = Layer.merge(FetchDMApiLive, SaveDMApiLive);

export const FetchDMLive = (dbOrTx: Database | Transaction = db) => FetchDMApiLive.pipe(Layer.provide(withLiveDB(dbOrTx)));
export const SaveDMLive = (dbOrTx: Database | Transaction = db) => SaveDMApiLive.pipe(Layer.provide(withLiveDB(dbOrTx)));
export const DMLive = (dbOrTx: Database | Transaction = db) => DMApiLive.pipe(Layer.provide(withLiveDB(dbOrTx)));

export function withFetchDM<R, E extends FetchDMError>(
	impl: (service: FetchDMApiImpl) => Effect.Effect<R, E>,
	dbOrTx: Database | Transaction = db
) {
	return Effect.gen(function* () {
		const FetchDMService = yield* FetchDMApi;
		return yield* impl(FetchDMService);
	}).pipe(Effect.provide(DMLive(dbOrTx)));
}

export function withSaveDM<R, E extends SaveDMError>(
	impl: (service: SaveDMApiImpl) => Effect.Effect<R, E>,
	dbOrTx: Database | Transaction = db
) {
	return Effect.gen(function* () {
		const SaveDMService = yield* SaveDMApi;
		return yield* impl(SaveDMService);
	}).pipe(Effect.provide(DMLive(dbOrTx)));
}

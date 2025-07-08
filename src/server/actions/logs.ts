import { type LogId, type LogSchema, type UserId } from "$lib/schemas";
import { getFuzzyDM } from "$server/data/dms";
import { getLog } from "$server/data/logs";
import { buildConflictUpdateColumns } from "$server/db";
import { DBService, FormError, withTransaction } from "$server/db/effect";
import { dungeonMasters, logs, magicItems, storyAwards } from "$server/db/schema";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { Effect } from "effect";

class SaveLogError extends FormError<LogSchema> {}
function createLogError(err: unknown): SaveLogError {
	return SaveLogError.from(err);
}

export function saveLog(input: LogSchema, user: LocalsSession["user"]) {
	return Effect.tryPromise({
		try: () => withTransaction(upsertLog(input, user)),
		catch: createLogError
	});
}

function upsertLog(input: LogSchema, user: LocalsSession["user"]) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		const [dm] = yield* upsertLogDM(input, user);

		if (!dm?.id)
			return yield* new SaveLogError("Could not save Dungeon Master", {
				field: input.isDmLog || input.type === "nongame" ? "" : "dm.id"
			});

		const appliedDate: Date | null = input.isDmLog
			? input.characterId && input.appliedDate !== null
				? new Date(input.appliedDate)
				: null
			: new Date(input.date);

		const [log] = yield* Effect.tryPromise({
			try: () =>
				db
					.insert(logs)
					.values({
						id: input.id || undefined,
						name: input.name,
						date: input.date,
						description: input.description || "",
						type: input.type,
						isDmLog: input.isDmLog,
						dungeonMasterId: dm.id,
						acp: input.acp,
						tcp: input.tcp,
						experience: input.experience,
						level: input.level,
						gold: input.gold,
						dtd: input.dtd,
						characterId: input.characterId,
						appliedDate
					})
					.onConflictDoUpdate({
						target: logs.id,
						set: buildConflictUpdateColumns(logs, ["id", "createdAt", "isDmLog"], true)
					})
					.returning(),
			catch: createLogError
		});

		if (!log?.id) return yield* new SaveLogError(input.id ? "Could not save log" : "Could not create log");

		yield* Effect.forEach(
			[
				{
					logId: log.id,
					table: magicItems,
					gained: input.magicItemsGained,
					lost: input.magicItemsLost
				},
				{
					logId: log.id,
					table: storyAwards,
					gained: input.storyAwardsGained,
					lost: input.storyAwardsLost
				}
			],
			itemsCRUD
		);

		return yield* getLog(log.id, user.id).pipe(
			Effect.flatMap((log) =>
				log ? Effect.succeed(log) : Effect.fail(new SaveLogError(input.id ? "Could not save log" : "Could not create log"))
			),
			Effect.catchAll(createLogError)
		);
	});
}

function validateDM(input: LogSchema, user: LocalsSession["user"]) {
	return Effect.gen(function* () {
		let isUser = input.isDmLog || input.dm.isUser || ["", user.name.toLowerCase()].includes(input.dm.name.toLowerCase().trim());
		let dmId = input.dm.id;
		let dmName = input.dm.name.trim();

		if (!input.dm.name.trim()) {
			if (isUser) {
				dmName = user.name.trim();
				isUser = true;
			} else {
				return yield* new SaveLogError("Dungeon Master name is required", {
					status: 400,
					field: "dm.name"
				});
			}
		}

		if (!dmId && (isUser || dmName || input.dm.DCI)) {
			const search = yield* getFuzzyDM(user.id, isUser, input.dm).pipe(Effect.catchAll(createLogError));
			if (search) {
				if (search.name === dmName && search.DCI === input.dm.DCI) {
					return { id: search.id, name: search.name, DCI: search.DCI, userId: user.id, isUser: search.isUser };
				}
				if (search.isUser) isUser = true;
				dmId = search.id;
			}
		}

		return {
			id: dmId || undefined,
			name: dmName,
			DCI: input.dm.DCI,
			userId: user.id,
			isUser
		};
	});
}

function upsertLogDM(input: LogSchema, user: LocalsSession["user"]) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		const validated = yield* validateDM(input, user);

		return yield* Effect.tryPromise({
			try: () =>
				db
					.insert(dungeonMasters)
					.values(validated)
					.onConflictDoUpdate({
						target: dungeonMasters.id,
						set: buildConflictUpdateColumns(dungeonMasters, ["name", "DCI"])
					})
					.returning(),
			catch: createLogError
		});
	});
}

interface CRUDItemParams {
	logId: LogId;
}

interface CRUDMagicItemParams extends CRUDItemParams {
	table: typeof magicItems;
	gained: LogSchema["magicItemsGained"];
	lost: LogSchema["magicItemsLost"];
}

interface CRUDStoryAwardParams extends CRUDItemParams {
	table: typeof storyAwards;
	gained: LogSchema["storyAwardsGained"];
	lost: LogSchema["storyAwardsLost"];
}

function itemsCRUD(params: CRUDMagicItemParams | CRUDStoryAwardParams) {
	return Effect.gen(function* () {
		const { logId, table, gained, lost } = params;

		const Database = yield* DBService;
		const db = yield* Database.db;

		const itemIds = gained.map((item) => item.id).filter(Boolean);
		yield* Effect.tryPromise({
			try: () =>
				db.delete(table).where(and(eq(table.logGainedId, logId), itemIds.length ? notInArray(table.id, itemIds) : undefined)),
			catch: createLogError
		});

		if (gained.length) {
			yield* Effect.tryPromise({
				try: () =>
					db
						.insert(table)
						.values(
							gained.map((item) => ({
								id: item.id || undefined,
								name: item.name,
								description: item.description,
								logGainedId: logId
							}))
						)
						.onConflictDoUpdate({
							target: table.id,
							set: buildConflictUpdateColumns(table, ["name", "description"])
						}),
				catch: createLogError
			});
		}

		yield* Effect.tryPromise({
			try: () =>
				db
					.update(table)
					.set({ logLostId: null })
					.where(and(eq(table.logLostId, logId), notInArray(table.id, lost))),
			catch: createLogError
		});
		if (lost.length) {
			yield* Effect.tryPromise({
				try: () =>
					db
						.update(table)
						.set({ logLostId: logId })
						.where(and(isNull(table.logLostId), inArray(table.id, lost))),
				catch: createLogError
			});
		}
	});
}

export function deleteLog(logId: LogId, userId: UserId) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		const log = yield* getLog(logId, userId).pipe(Effect.catchAll(createLogError));

		if (!log) return yield* new SaveLogError("Log not found", { status: 404 });
		if (!log.isDmLog && log.character && log.character.userId !== userId)
			return yield* new SaveLogError("Not authorized", { status: 401 });
		if (log.isDmLog && log.dm.isUser) return yield* new SaveLogError("Not authorized", { status: 401 });

		return yield* Effect.tryPromise({
			try: () => db.delete(logs).where(eq(logs.id, logId)).returning({ id: logs.id }),
			catch: createLogError
		}).pipe(
			Effect.flatMap((c) =>
				Effect.all(c.map((d) => (d ? Effect.succeed(d) : Effect.fail(new SaveLogError("Could not delete log")))))
			)
		);
	});
}

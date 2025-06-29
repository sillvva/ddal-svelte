import { getLevels } from "$lib/entities";
import { type LogId, type LogSchema, type UserId } from "$lib/schemas";
import { SaveError, type SaveResult } from "$lib/util";
import { type LogData } from "$server/data/logs";
import { buildConflictUpdateColumns, db, type Transaction } from "$server/db";
import { extendedLogIncludes } from "$server/db/includes";
import { dungeonMasters, logs, magicItems, storyAwards } from "$server/db/schema";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";

class LogError extends SaveError<LogSchema> {}

export type SaveLogResult = ReturnType<typeof saveLog>;
export async function saveLog(input: LogSchema, user: LocalsSession["user"]): SaveResult<LogData, LogError> {
	try {
		const userId = user.id;
		const characterId = input.characterId;

		const log = await db.transaction(async (tx) => {
			const appliedDate: Date | null = input.isDmLog
				? input.characterId && input.appliedDate !== null
					? new Date(input.appliedDate)
					: null
				: new Date(input.date);
			if (input.characterId && appliedDate === null)
				throw new LogError("Applied date is required if character is selected", { status: 400, field: "appliedDate" });

			if (characterId) {
				const character = await tx.query.characters.findFirst({
					with: {
						logs: true
					},
					where: {
						id: {
							eq: characterId
						}
					}
				});

				if (!character)
					throw new LogError("Character not found", {
						status: 404,
						field: input.isDmLog ? "characterId" : undefined
					});

				const currentLevel = getLevels(character.logs).total;
				const logACP = character.logs.find((log) => log.id === input.id)?.acp || 0;
				if (currentLevel == 20 && input.acp - logACP > 0)
					throw new LogError("Cannot increase level above 20", { status: 400, field: "acp" });
				const logLevel = character.logs.find((log) => log.id === input.id)?.level || 0;
				if (currentLevel + input.level - logLevel > 20)
					throw new LogError("Cannot increase level above 20", { status: 400, field: "level" });
			}

			const [dm] = await (async () => {
				let isUser =
					input.isDmLog || input.dm.isUser || ["", user.name.toLowerCase()].includes(input.dm.name.toLowerCase().trim());

				if (!input.dm.name.trim()) {
					if (isUser) input.dm.name = user.name;
					else
						throw new LogError("Dungeon Master name is required", {
							status: 400,
							field: input.isDmLog || input.type === "nongame" ? "" : "dm.id"
						});
				}

				if (!input.dm.id && (isUser || input.dm.name.trim() || input.dm.DCI)) {
					const search = await tx.query.dungeonMasters.findFirst({
						where: {
							userId: {
								eq: userId
							},
							...(isUser
								? { isUser }
								: {
										name: input.dm.name.trim() || undefined,
										DCI: input.dm.DCI || undefined
									})
						}
					});
					if (search) {
						if (search.name === input.dm.name.trim() && search.DCI === input.dm.DCI) return [search];
						if (search.isUser) isUser = true;
						input.dm.id = search.id;
					}
				}

				try {
					return await tx
						.insert(dungeonMasters)
						.values({
							id: input.dm.id || undefined,
							name: input.dm.name.trim(),
							DCI: input.dm.DCI,
							userId,
							isUser
						})
						.onConflictDoUpdate({
							target: dungeonMasters.id,
							set: buildConflictUpdateColumns(dungeonMasters, ["name", "DCI"])
						})
						.returning();
				} catch (err) {
					console.error(err);
					throw err;
				}
			})();

			if (!dm?.id)
				throw new LogError("Could not save Dungeon Master", {
					field: input.isDmLog || input.type === "nongame" ? "" : "dm.id"
				});

			const [log] = await tx
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
					characterId,
					appliedDate
				})
				.onConflictDoUpdate({
					target: logs.id,
					set: buildConflictUpdateColumns(logs, ["id", "createdAt", "isDmLog"], true)
				})
				.returning();

			if (!log?.id) throw new LogError("Database error. Could not save log");

			await itemsCRUD({ tx, logId: log.id, table: magicItems, gained: input.magicItemsGained, lost: input.magicItemsLost });
			await itemsCRUD({ tx, logId: log.id, table: storyAwards, gained: input.storyAwardsGained, lost: input.storyAwardsLost });

			const updated = await tx.query.logs.findFirst({
				with: extendedLogIncludes,
				where: {
					id: {
						eq: log.id
					}
				}
			});

			return updated;
		});

		if (!log) throw new LogError("Database transaction error. Could not save log");

		return log;
	} catch (err) {
		return LogError.from(err);
	}
}

interface CRUDItemParams {
	tx: Transaction;
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

async function itemsCRUD(params: CRUDMagicItemParams | CRUDStoryAwardParams) {
	const { tx, logId, table, gained, lost } = params;

	const itemIds = gained.map((item) => item.id).filter(Boolean);
	await tx.delete(table).where(and(eq(table.logGainedId, logId), itemIds.length ? notInArray(table.id, itemIds) : undefined));

	if (gained.length) {
		await tx
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
			});
	}

	await tx
		.update(table)
		.set({ logLostId: null })
		.where(and(eq(table.logLostId, logId), notInArray(table.id, lost)));
	if (lost.length) {
		await tx
			.update(table)
			.set({ logLostId: logId })
			.where(and(isNull(table.logLostId), inArray(table.id, lost)));
	}
}

export type DeleteLogResult = ReturnType<typeof deleteLog>;
export async function deleteLog(logId: LogId, userId: UserId): SaveResult<{ id: LogId }, LogError> {
	try {
		const log = await db.transaction(async (tx) => {
			const log = await tx.query.logs.findFirst({
				with: {
					dm: true,
					character: true
				},
				where: {
					id: {
						eq: logId
					}
				}
			});

			if (!log) throw new LogError("Log not found", { status: 404 });
			if (!log.isDmLog && log.character && log.character.userId !== userId) throw new LogError("Not authorized", { status: 401 });
			if (log.isDmLog && log.dm.isUser) throw new LogError("Not authorized", { status: 401 });

			await tx.delete(logs).where(eq(logs.id, logId));

			return log;
		});

		return { id: log.id };
	} catch (err) {
		return LogError.from(err);
	}
}

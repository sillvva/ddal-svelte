import { getLevels } from "$lib/entities";
import { type LogId, type LogSchema, type UserId } from "$lib/schemas";
import { SaveError, type SaveResult } from "$lib/util";
import { rateLimiter, revalidateKeys } from "$server/cache";
import { logIncludes, type LogData } from "$server/data/logs";
import { buildConflictUpdateColumns, db } from "$server/db";
import { dungeonMasters, logs, magicItems, storyAwards, type InsertDungeonMaster, type Log } from "$server/db/schema";
import { and, eq, inArray, notInArray } from "drizzle-orm";

class LogError extends SaveError<LogSchema> {}

export type SaveLogResult = ReturnType<typeof saveLog>;
export async function saveLog(input: LogSchema, user: LocalsUser): SaveResult<LogData, LogSchema> {
	try {
		const userId = user.id;
		const characterId = input.characterId;

		const { success } = await rateLimiter(input.id ? "insert" : "update", user.id);
		if (!success) throw new LogError("Too many requests", { status: 429 });

		const log = await db.transaction(async (tx) => {
			const appliedDate: Date | null = input.isDmLog
				? input.characterId && input.appliedDate !== null
					? new Date(input.appliedDate)
					: null
				: new Date(input.date);
			if (input.characterId && appliedDate === null)
				throw new LogError("Applied date is required", { status: 400, field: "appliedDate" });

			if (characterId) {
				const character = await tx.query.characters.findFirst({
					with: {
						logs: true
					},
					where: (characters, { eq }) => eq(characters.id, characterId)
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
				let isMe = false;
				if (input.isDmLog) isMe = true;
				if (input.dm.uid === userId) isMe = true;
				if (["", user.name.toLowerCase()].includes(input.dm.name.toLowerCase().trim())) isMe = true;

				if (!input.dm.id) {
					const search = await tx.query.dungeonMasters.findFirst({
						where: (dms, { eq, or, and }) =>
							and(
								eq(dms.owner, userId),
								isMe
									? eq(dms.uid, userId)
									: input.dm.DCI
										? or(eq(dms.name, input.dm.name.trim()), eq(dms.DCI, input.dm.DCI))
										: eq(dms.name, input.dm.name.trim())
							)
					});
					if (search) {
						input.dm.id = search.id;
						if (!input.dm.name) input.dm.name = search.name;
						if (!input.dm.DCI) input.dm.DCI = search.DCI;
						if (!input.dm.owner) input.dm.owner = userId;
						if (search.uid === userId) isMe = true;
					}
				}

				if (!input.dm.name) {
					if (isMe) input.dm.name = user.name;
					else
						throw new LogError("Dungeon Master name is required", {
							status: 400,
							field: "dm.id"
						});
				}

				try {
					const dm: InsertDungeonMaster = {
						name: input.dm.name.trim(),
						DCI: input.dm.DCI,
						uid: input.isDmLog || isMe ? userId : null,
						owner: userId
					};
					if (input.dm.id) {
						return await tx.update(dungeonMasters).set(dm).where(eq(dungeonMasters.id, input.dm.id)).returning();
					} else {
						return await tx.insert(dungeonMasters).values(dm).returning();
					}
				} catch (err) {
					console.error(err);
					throw err;
				}
			})();

			if (!dm?.id)
				throw new LogError("Could not save Dungeon Master", {
					field: "dm.id"
				});

			const data: Omit<Log, "id" | "createdAt"> = {
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
			};

			const [log] = input.id
				? await tx.update(logs).set(data).where(eq(logs.id, input.id)).returning()
				: await tx.insert(logs).values(data).returning();

			if (!log?.id) throw new LogError("Could not save log");

			const itemIds = input.magicItemsGained.map((item) => item.id).filter(Boolean);
			if (itemIds.length) {
				await tx.delete(magicItems).where(and(eq(magicItems.logGainedId, log.id), notInArray(magicItems.id, itemIds)));
			}

			if (input.magicItemsGained.length) {
				await tx
					.insert(magicItems)
					.values(
						input.magicItemsGained.map((item) => ({
							...item,
							logGainedId: log.id
						}))
					)
					.onConflictDoUpdate({
						target: magicItems.id,
						set: buildConflictUpdateColumns(magicItems, ["name", "description"])
					});
			}

			await tx.update(magicItems).set({ logLostId: null }).where(eq(magicItems.logLostId, log.id));
			if (input.magicItemsLost.length) {
				await tx.update(magicItems).set({ logLostId: log.id }).where(inArray(magicItems.id, input.magicItemsLost));
			}

			const awardIds = input.storyAwardsGained.map((item) => item.id).filter(Boolean);
			if (awardIds.length) {
				await tx.delete(storyAwards).where(and(eq(storyAwards.logGainedId, log.id), notInArray(storyAwards.id, awardIds)));
			}

			if (input.storyAwardsGained.length) {
				await tx
					.insert(storyAwards)
					.values(
						input.storyAwardsGained.map((item) => ({
							...item,
							logGainedId: log.id
						}))
					)
					.onConflictDoUpdate({
						target: storyAwards.id,
						set: buildConflictUpdateColumns(storyAwards, ["name", "description"])
					});
			}

			await tx.update(storyAwards).set({ logLostId: null }).where(eq(storyAwards.logLostId, log.id));
			if (input.storyAwardsLost.length) {
				await tx.update(storyAwards).set({ logLostId: log.id }).where(inArray(storyAwards.id, input.storyAwardsLost));
			}

			const updated = await tx.query.logs.findFirst({
				with: logIncludes,
				where: (logs, { eq }) => eq(logs.id, log.id)
			});

			return updated;
		});

		if (!log) throw new LogError("Could not save log");

		revalidateKeys([
			log.isDmLog && log.dm?.uid && ["dm-logs", log.dm.uid],
			log.characterId && ["character", log.characterId, "logs"],
			user.id && ["dms", user.id, "logs"],
			user.id && ["search-data", user.id]
		]);

		return log;
	} catch (err) {
		return LogError.from(err);
	}
}

export type DeleteLogResult = ReturnType<typeof deleteLog>;
export async function deleteLog(logId: LogId, userId?: UserId): SaveResult<{ id: LogId }, LogSchema> {
	try {
		if (!userId) throw new LogError("Not authenticated", { status: 401 });

		const { success } = await rateLimiter("insert", userId);
		if (!success) throw new LogError("Too many requests", { status: 429 });

		const log = await db.transaction(async (tx) => {
			const log = await tx.query.logs.findFirst({
				with: {
					dm: true,
					character: true
				},
				where: (logs, { eq }) => eq(logs.id, logId)
			});

			if (!log) throw new LogError("Log not found", { status: 404 });
			if (log.character && log.character.userId !== userId) throw new LogError("Not authorized", { status: 401 });
			if (log.dm && log.dm.uid !== userId) throw new LogError("Not authorized", { status: 401 });

			await tx.delete(logs).where(eq(logs.id, logId));

			return log;
		});

		revalidateKeys([
			log.isDmLog && log.dm?.uid && ["dm-logs", log.dm.uid],
			log.characterId && ["character", log.characterId, "logs"],
			["search-data", userId]
		]);

		return { id: log.id };
	} catch (err) {
		return LogError.from(err);
	}
}

import { getLevels } from "$lib/entities";
import { SaveError, type LogSchema, type SaveResult } from "$lib/schemas";
import { handleSKitError, handleSaveError } from "$lib/util";
import { rateLimiter, revalidateKeys } from "$server/cache";
import { db } from "$server/db";
import { dungeonMasters, logs, magicItems, storyAwards, type InsertDungeonMaster, type Log } from "$server/db/schema";
import { error } from "@sveltejs/kit";
import { and, eq, inArray, notInArray } from "drizzle-orm";

export type SaveLogResult = ReturnType<typeof saveLog>;
export async function saveLog(input: LogSchema, user?: CustomSession["user"]): SaveResult<{ id: string; log: Log }, LogSchema> {
	try {
		if (!user?.name || !user?.id) throw new SaveError(401, "Not authenticated");
		const userId = user.id;

		const { success } = await rateLimiter(input.id ? "insert" : "update", user.id);
		if (!success) throw new SaveError(429, "Too many requests");

		const log = await db.transaction(async (tx) => {
			const applied_date: Date | null = input.is_dm_log
				? input.characterId && input.applied_date !== null
					? new Date(input.applied_date)
					: null
				: new Date(input.date);
			if (input.characterId && applied_date === null)
				throw new SaveError<LogSchema>(400, "Applied date is required", {
					field: "applied_date"
				});

			if (input.characterId) {
				const character = await tx.query.characters.findFirst({
					with: {
						logs: true
					},
					where: (characters, { eq }) => eq(characters.id, input.characterId)
				});

				if (!character)
					throw new SaveError<LogSchema>(404, "Character not found", {
						field: input.is_dm_log ? "characterId" : undefined
					});

				const currentLevel = getLevels(character.logs).total;
				const logACP = character.logs.find((log) => log.id === input.id)?.acp || 0;
				if (currentLevel == 20 && input.acp - logACP > 0)
					throw new SaveError<LogSchema>(400, "Cannot increase level above 20", {
						field: "acp"
					});
				const logLevel = character.logs.find((log) => log.id === input.id)?.level || 0;
				if (currentLevel + input.level - logLevel > 20)
					throw new SaveError<LogSchema>(400, "Cannot increase level above 20", {
						field: "level"
					});
			}

			const [dm] = await (async () => {
				let isMe = false;
				if (input.is_dm_log) isMe = true;
				if (input.dm.uid === userId) isMe = true;
				if (["Me", "", user.name?.trim()].includes(input.dm.name.trim())) isMe = true;

				if (isMe && !input.dm.name) input.dm.name = user.name || "Me";

				if (input.dm?.name.trim()) {
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
							if (search.uid === userId) {
								input.dm.uid = userId;
								isMe = true;
							}
							if (!input.dm.owner) input.dm.owner = userId;
						}
					}

					try {
						const dm: InsertDungeonMaster = {
							name: input.dm.name.trim(),
							DCI: input.dm.DCI,
							uid: input.is_dm_log || isMe ? userId : null,
							owner: userId
						};
						if (input.dm.id) {
							return await tx.update(dungeonMasters).set(dm).where(eq(dungeonMasters.id, input.dm.id)).returning();
						} else {
							return await tx.insert(dungeonMasters).values(dm).returning();
						}
					} catch (err) {
						console.error(err);
					}
				}

				return [null];
			})();

			if (!dm?.id) throw new SaveError(500, "Could not save Dungeon Master");

			const data: Omit<Log, "id" | "created_at"> = {
				name: input.name,
				date: input.date,
				description: input.description || "",
				type: input.type,
				is_dm_log: input.is_dm_log,
				dungeonMasterId: dm.id,
				acp: input.acp,
				tcp: input.tcp,
				experience: input.experience,
				level: input.level,
				gold: input.gold,
				dtd: input.dtd,
				characterId: input.characterId,
				applied_date
			};

			const [log] = input.id
				? await tx.update(logs).set(data).where(eq(logs.id, input.id)).returning()
				: await tx.insert(logs).values(data).returning();

			if (!log?.id) throw new SaveError(500, "Could not save log");

			const itemsToUpdate = input.magic_items_gained.filter((item) => item.id);
			for (const item of itemsToUpdate) {
				await tx
					.update(magicItems)
					.set({
						name: item.name,
						description: item.description
					})
					.where(eq(magicItems.id, item.id));
			}

			const itemsToDelete = itemsToUpdate.map((item) => item.id);
			if (itemsToDelete.length) {
				await tx.delete(magicItems).where(notInArray(magicItems.id, itemsToDelete));
			}

			const itemsToCreate = input.magic_items_gained.filter((item) => !item.id);
			if (itemsToCreate.length) {
				await tx.insert(magicItems).values(
					itemsToCreate.map((item) => ({
						name: item.name,
						description: item.description,
						logGainedId: log.id
					}))
				);
			}

			await tx
				.update(magicItems)
				.set({ logLostId: null })
				.where(and(eq(magicItems.logLostId, log.id)));
			if (input.magic_items_lost.length) {
				await tx.update(magicItems).set({ logLostId: log.id }).where(inArray(magicItems.id, input.magic_items_lost));
			}

			const storyAwardsToUpdate = input.magic_items_gained.filter((item) => item.id);
			for (const item of storyAwardsToUpdate) {
				await tx
					.update(storyAwards)
					.set({
						name: item.name,
						description: item.description
					})
					.where(eq(storyAwards.id, item.id));
			}

			const storyAwardsToDelete = storyAwardsToUpdate.map((item) => item.id);
			if (storyAwardsToDelete.length) {
				await tx.delete(storyAwards).where(notInArray(storyAwards.id, storyAwardsToDelete));
			}

			const storyAwardsToCreate = input.magic_items_gained.filter((item) => !item.id);
			if (storyAwardsToCreate.length) {
				await tx.insert(storyAwards).values(
					storyAwardsToCreate.map((item) => ({
						name: item.name,
						description: item.description,
						logGainedId: log.id
					}))
				);
			}

			await tx
				.update(storyAwards)
				.set({ logLostId: null })
				.where(and(eq(storyAwards.logLostId, log.id)));
			if (input.story_awards_lost.length) {
				await tx.update(storyAwards).set({ logLostId: log.id }).where(inArray(storyAwards.id, input.story_awards_lost));
			}

			const updated = await tx.query.logs.findFirst({
				with: {
					dm: true,
					magic_items_gained: true,
					magic_items_lost: true,
					story_awards_gained: true,
					story_awards_lost: true
				},
				where: (logs, { eq }) => eq(logs.id, log.id)
			});

			return updated;
		});

		if (!log) throw new SaveError(500, "Could not save log");

		revalidateKeys([
			log.is_dm_log && log.dm?.uid && ["dm-logs", log.dm.uid],
			log.characterId && ["character", log.characterId, "logs"],
			user.id && ["dms", user.id, "logs"],
			user.id && ["search-data", user.id]
		]);

		return { id: log.id, log };
	} catch (err) {
		return handleSaveError(err);
	}
}

export type DeleteLogResult = ReturnType<typeof deleteLog>;
export async function deleteLog(logId: string, userId?: string) {
	try {
		if (!userId) error(401, "Not authenticated");

		const { success } = await rateLimiter("insert", userId);
		if (!success) throw new SaveError(429, "Too many requests");

		const log = await db.transaction(async (tx) => {
			const log = await tx.query.logs.findFirst({
				with: {
					dm: true,
					character: true
				},
				where: (logs, { eq }) => eq(logs.id, logId)
			});
			if (log) {
				if (log.character?.userId !== userId && log.dm?.uid !== userId) error(401, "Not authorized");
				await tx.update(magicItems).set({ logLostId: null }).where(eq(magicItems.logLostId, logId));
				await tx.update(storyAwards).set({ logLostId: null }).where(eq(storyAwards.logLostId, logId));
				await tx.delete(logs).where(eq(logs.id, logId));
			}
			return log;
		});

		revalidateKeys([
			log?.is_dm_log && log.dm?.uid && ["dm-logs", log.dm.uid],
			log?.characterId && ["character", log.characterId, "logs"],
			["search-data", userId]
		]);

		return { id: log?.id || null, error: null };
	} catch (err) {
		handleSKitError(err);
		if (err instanceof Error) return { id: null, dm: null, error: err.message };
		return { id: null, dm: null, error: "An unknown error has occurred." };
	}
}

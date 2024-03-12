import { getLevels } from "$lib/entities";
import { SaveError, type LogSchema, type SaveResult } from "$lib/schemas";
import { handleSKitError, handleSaveError, parseError } from "$lib/util";
import { dungeonMasters, logs, magicItems, storyAwards, type Log } from "$src/db/schema";
import { error } from "@sveltejs/kit";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { rateLimiter, revalidateKeys } from "../cache";
import { db } from "../db";

export type SaveLogResult = ReturnType<typeof saveLog>;
export async function saveLog(input: LogSchema, user?: CustomSession["user"]): SaveResult<{ id: string; log: Log }, LogSchema> {
	try {
		if (!user?.name || !user?.id) throw new SaveError(401, "Not authenticated");
		const userId = user.id;

		const { success } = await rateLimiter(input.id ? "insert" : "update", "save-log", user.id);
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

			const dm = await (async () => {
				if (input.is_dm_log) input.dm.name = user.name || "Me";
				if (["Me", ""].includes(input.dm.name.trim())) input.dm.name = user.name || "Me";
				const isMe = input.dm.name.trim() === user.name?.trim() || input.dm.name === "Me" || input.dm.name === "";

				if (isMe) {
					const dm = await tx.query.dungeonMasters.findFirst({
						where: (dms, { eq }) => eq(dms.uid, userId)
					});
					if (dm) input.dm = dm;
				}

				if (input.dm?.name.trim()) {
					if (!input.dm.id) {
						const search = await tx.query.dungeonMasters.findFirst({
							where: (dms, { eq, or, and }) =>
								and(
									eq(dms.owner, userId),
									input.is_dm_log || isMe
										? eq(dms.uid, userId)
										: input.dm.DCI
											? or(eq(dms.name, input.dm.name.trim()), eq(dms.DCI, input.dm.DCI))
											: eq(dms.name, input.dm.name.trim())
								)
						});
						if (search) {
							input.dm.id = search.id;
							if (!input.dm.owner) input.dm.owner = userId;
						}
					}

					try {
						if (!input.dm.id) {
							return await tx
								.insert(dungeonMasters)
								.values({
									name: input.dm.name.trim(),
									DCI: input.dm.DCI,
									uid: input.is_dm_log || isMe ? user.id : null,
									owner: userId
								})
								.returning()
								.then((r) => r[0]);
						} else {
							return await tx
								.update(dungeonMasters)
								.set({
									name: input.dm.name.trim(),
									DCI: input.dm.DCI,
									uid: input.is_dm_log || isMe ? user.id : null,
									owner: user.id
								})
								.where(eq(dungeonMasters.id, input.dm.id))
								.returning()
								.then((r) => r[0]);
						}
					} catch (err) {
						throw new SaveError(500, parseError(err));
					}
				}
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

			const log = input.id
				? await tx
						.update(logs)
						.set(data)
						.where(eq(logs.id, input.id))
						.returning()
						.then((r) => r[0])
				: await tx
						.insert(logs)
						.values({
							...data,
							created_at: new Date()
						})
						.returning()
						.then((r) => r[0]);

			if (!log.id) throw new SaveError(500, "Could not save log");

			const itemsToUpdate = input.magic_items_gained.filter((item) => item.id);

			if (itemsToUpdate.length) {
				await tx.delete(magicItems).where(
					notInArray(
						magicItems.id,
						itemsToUpdate.map((item) => item.id)
					)
				);
			}

			const items = input.magic_items_gained.filter((item) => !item.id);
			if (items.length) {
				await tx.insert(magicItems).values(
					items.map((item) => ({
						name: item.name,
						description: item.description,
						logGainedId: log.id
					}))
				);
			}

			for (const item of itemsToUpdate) {
				await tx
					.update(magicItems)
					.set({
						name: item.name,
						description: item.description
					})
					.where(eq(magicItems.id, item.id));
			}

			if (input.magic_items_lost.length) {
				await tx
					.update(magicItems)
					.set({ logLostId: null })
					.where(and(eq(magicItems.logLostId, log.id), notInArray(magicItems.id, input.magic_items_lost)));

				await tx.update(magicItems).set({ logLostId: log.id }).where(inArray(magicItems.id, input.magic_items_lost));
			}

			const storyAwardsToUpdate = input.story_awards_gained.filter((item) => item.id);

			if (storyAwardsToUpdate.length) {
				await tx.delete(storyAwards).where(
					notInArray(
						storyAwards.id,
						storyAwardsToUpdate.map((item) => item.id)
					)
				);
			}

			const story_awards = input.story_awards_gained.filter((item) => !item.id);
			if (story_awards.length) {
				await tx.insert(storyAwards).values(
					story_awards.map((item) => ({
						name: item.name,
						description: item.description,
						logGainedId: log.id
					}))
				);
			}

			for (const item of storyAwardsToUpdate) {
				await tx
					.update(storyAwards)
					.set({
						name: item.name,
						description: item.description
					})
					.where(eq(storyAwards.id, item.id));
			}

			if (input.story_awards_lost.length) {
				await tx
					.update(storyAwards)
					.set({ logLostId: null })
					.where(and(eq(storyAwards.logLostId, log.id), notInArray(storyAwards.id, input.magic_items_lost)));

				await tx.update(storyAwards).set({ logLostId: log.id }).where(inArray(storyAwards.id, input.magic_items_lost));
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

		const { success } = await rateLimiter("insert", "delete-log", userId);
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

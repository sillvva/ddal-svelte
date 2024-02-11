import { getLevels } from "$lib/entities";
import { handleSKitError, parseError } from "$lib/util";
import { error } from "@sveltejs/kit";
import { revalidateKeys } from "../cache";
import { prisma } from "../db";

import { SaveError, type LogSchema, type SaveResult } from "$lib/schemas";
import type { DungeonMaster, Log } from "@prisma/client";

export type SaveLogResult = ReturnType<typeof saveLog>;
export async function saveLog(input: LogSchema, user?: CustomSession["user"]): SaveResult<{ id: string; log: Log }> {
	try {
		let dm: DungeonMaster | null = null;
		if (!user?.name) throw new SaveError(401, "Not authenticated");

		if (input.is_dm_log) input.dm.name = user.name || "Me";
		if (["Me", ""].includes(input.dm.name.trim())) input.dm.name = user.name || "Me";
		const isMe = input.dm.name.trim() === user.name?.trim() || input.dm.name === "Me";

		const log = await prisma.$transaction(async (tx) => {
			if (!user?.id) throw new SaveError(401, "Not authenticated");

			if (input.dm?.name.trim()) {
				if (!input.dm.id) {
					const search = await tx.dungeonMaster.findFirst({
						where: {
							owner: user.id,
							OR:
								input.is_dm_log || isMe
									? [{ uid: user.id }]
									: input.dm.DCI
										? [{ name: input.dm.name.trim() }, { DCI: input.dm.DCI }]
										: [{ name: input.dm.name.trim() }]
						}
					});
					if (search) {
						input.dm.id = search.id;
						if (!input.dm.owner) input.dm.owner = search.owner || user.id;
					}
				}

				if (!input.dm.id) {
					dm = await tx.dungeonMaster.create({
						data: {
							name: input.dm.name.trim(),
							DCI: input.dm.DCI,
							uid: input.is_dm_log || isMe ? user.id : null,
							owner: user.id
						}
					});
				} else {
					try {
						dm = await tx.dungeonMaster.update({
							where: {
								id: input.dm.id
							},
							data: {
								name: input.dm.name.trim(),
								DCI: input.dm.DCI,
								uid: input.is_dm_log || isMe ? user.id : null,
								owner: user.id
							}
						});
					} catch (err) {
						error(500, parseError(err));
					}
				}
			}

			if (!dm?.id) throw new SaveError(500, "Could not save Dungeon Master");

			const applied_date: Date | null = input.is_dm_log
				? input.characterId && input.applied_date !== null
					? new Date(input.applied_date)
					: null
				: new Date(input.date);
			if (input.characterId && applied_date === null) throw new SaveError(400, "Applied date is required");

			if (input.characterId) {
				const character = await tx.character.findFirst({
					include: {
						logs: true
					},
					where: { id: input.characterId }
				});

				if (!character) throw new SaveError(404, "Character not found");

				const currentLevel = getLevels(character.logs).total;
				const logACP = character.logs.find((log) => log.id === input.id)?.acp || 0;
				if (currentLevel == 20 && input.acp - logACP > 0) throw new SaveError(400, "Character is already level 20");
				const logLevel = character.logs.find((log) => log.id === input.id)?.level || 0;
				if (currentLevel + input.level - logLevel > 20) throw new SaveError(400, "Character cannot level past 20");
			}

			const data: Omit<Log, "id" | "created_at" | "is_dm_log"> = {
				name: input.name,
				date: new Date(input.date),
				description: input.description,
				type: input.type,
				dungeonMasterId: dm.id,
				applied_date: applied_date,
				characterId: input.characterId,
				acp: input.acp,
				tcp: input.tcp,
				experience: input.experience,
				level: input.level,
				gold: input.gold,
				dtd: input.dtd
			};

			const log: Log = await tx.log.upsert({
				where: {
					id: input.id
				},
				update: data,
				create: {
					...data,
					is_dm_log: input.is_dm_log
				}
			});

			if (!log.id) throw new SaveError(500, "Could not save log");

			const itemsToUpdate = input.magic_items_gained.filter((item) => item.id);

			await tx.magicItem.deleteMany({
				where: {
					logGainedId: log.id,
					id: {
						notIn: itemsToUpdate.map((item) => item.id)
					}
				}
			});

			await tx.magicItem.createMany({
				data: input.magic_items_gained
					.filter((item) => !item.id)
					.map((item) => ({
						name: item.name,
						description: item.description,
						logGainedId: log.id
					}))
			});

			for (const item of itemsToUpdate) {
				await tx.magicItem.update({
					where: {
						id: item.id
					},
					data: {
						name: item.name,
						description: item.description
					}
				});
			}

			await tx.magicItem.updateMany({
				where: {
					logLostId: log.id,
					id: {
						notIn: input.magic_items_lost
					}
				},
				data: {
					logLostId: null
				}
			});

			await tx.magicItem.updateMany({
				where: {
					id: {
						in: input.magic_items_lost
					}
				},
				data: {
					logLostId: log.id
				}
			});

			const storyAwardsToUpdate = input.story_awards_gained.filter((item) => item.id);

			await tx.storyAward.deleteMany({
				where: {
					logGainedId: log.id,
					id: {
						notIn: storyAwardsToUpdate.map((item) => item.id)
					}
				}
			});

			await tx.storyAward.createMany({
				data: input.story_awards_gained
					.filter((item) => !item.id)
					.map((item) => ({
						name: item.name,
						description: item.description,
						logGainedId: log.id
					}))
			});

			for (const item of storyAwardsToUpdate) {
				await tx.storyAward.update({
					where: {
						id: item.id
					},
					data: {
						name: item.name,
						description: item.description
					}
				});
			}
			await tx.storyAward.updateMany({
				where: {
					logLostId: log.id,
					id: {
						notIn: input.story_awards_lost
					}
				},
				data: {
					logLostId: null
				}
			});

			await tx.storyAward.updateMany({
				where: {
					id: {
						in: input.story_awards_lost
					}
				},
				data: {
					logLostId: log.id
				}
			});

			const updated = await tx.log.findFirst({
				where: {
					id: log.id
				},
				include: {
					dm: true,
					magic_items_gained: true,
					magic_items_lost: true,
					story_awards_gained: true,
					story_awards_lost: true
				}
			});

			return updated;
		});

		if (!log) throw new SaveError(500, "Could not save log");

		revalidateKeys([
			log.is_dm_log && log.dm?.uid && ["dm-logs", log.dm.uid],
			log.characterId && ["character", log.characterId, "logs"],
			user.id && ["dms", user.id, "logs"]
		]);

		return { id: log.id, log };
	} catch (err) {
		if (err instanceof SaveError) return err;
		if (err instanceof Error) return { status: 500, error: err.message };
		return { status: 500, error: "An unknown error has occurred." };
	}
}

export type DeleteLogResult = ReturnType<typeof deleteLog>;
export async function deleteLog(logId: string, userId?: string) {
	try {
		if (!userId) error(401, "Not authenticated");
		const log = await prisma.$transaction(async (tx) => {
			const log = await tx.log.findUnique({
				where: {
					id: logId
				},
				include: {
					dm: true,
					character: true
				}
			});
			if (log && log.character?.userId !== userId && log.dm?.uid !== userId) error(401, "Not authorized");
			await tx.magicItem.updateMany({
				where: {
					logLostId: logId
				},
				data: {
					logLostId: null
				}
			});
			await tx.magicItem.deleteMany({
				where: {
					logGainedId: logId
				}
			});
			await tx.storyAward.updateMany({
				where: {
					logLostId: logId
				},
				data: {
					logLostId: null
				}
			});
			await tx.storyAward.deleteMany({
				where: {
					logGainedId: logId
				}
			});
			if (log)
				await tx.log.delete({
					where: {
						id: logId
					}
				});
			return log;
		});

		revalidateKeys([
			log?.is_dm_log && log.dm?.uid && ["dm-logs", log.dm.uid],
			log?.characterId && ["character", log.characterId, "logs"]
		]);

		return { id: log?.id || null, error: null };
	} catch (err) {
		handleSKitError(err);
		if (err instanceof Error) return { id: null, dm: null, error: err.message };
		return { id: null, dm: null, error: "An unknown error has occurred." };
	}
}

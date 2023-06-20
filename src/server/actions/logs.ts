import { parseError } from "$lib/misc";
import { getLevels } from "../data/characters";
import { prisma } from "../db";

import type { logSchema } from "$src/lib/types/zod-schema";
import type { z } from "zod";
import type { DungeonMaster, Log } from "@prisma/client";
import type { User } from "@auth/core/types";

export type SaveLogResult = ReturnType<typeof saveLog>;
export async function saveLog(characterId: string, logId: string, input: z.infer<typeof logSchema>, user?: User) {
	try {
		let dm: DungeonMaster | null = null;
		if (!user) throw new Error("Not authenticated");
		const isMe = input.dm?.name.trim() === user.name?.trim();

		const log = await prisma.$transaction(async (tx) => {
			if (input.dm?.name.trim()) {
				if (!input.dm.id) {
					const search = await tx.dungeonMaster.findFirst({
						where: {
							OR:
								input.is_dm_log || isMe
									? [{ uid: user.id }]
									: input.dm.DCI === null
									? [{ name: input.dm.name.trim() }]
									: [{ name: input.dm.name.trim() }, { DCI: input.dm.DCI }]
						}
					});
					if (search) dm = search;
					else
						dm = await tx.dungeonMaster.create({
							data: {
								name: input.dm.name.trim(),
								DCI: input.dm.DCI,
								uid: input.is_dm_log || isMe ? user.id : null
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
								uid: input.is_dm_log || isMe ? user.id : null
							}
						});
					} catch (err) {
						throw new Error(parseError(err));
					}
				}
			}

			if (input.type == "game" && !dm?.id) throw new Error("Could not save Dungeon Master");

			const applied_date: Date | null = input.is_dm_log
				? input.characterId && input.applied_date !== null
					? new Date(input.applied_date)
					: null
				: new Date(input.date);
			if (input.characterId && applied_date === null) throw new Error("Applied date is required");

			if (input.characterId) {
				const character = await tx.character.findFirst({
					include: {
						logs: true
					},
					where: { id: input.characterId }
				});

				if (!character) throw new Error("Character not found");

				const currentLevel = getLevels(character.logs).total;
				const logACP = character.logs.find((log) => log.id === input.logId)?.acp || 0;
				if (currentLevel == 20 && input.acp - logACP > 0) throw new Error("Character is already level 20");
				const logLevel = character.logs.find((log) => log.id === input.logId)?.level || 0;
				if (currentLevel + input.level - logLevel > 20) throw new Error("Character cannot level past 20");
			}

			const data: Omit<Log, "id" | "created_at"> = {
				name: input.name,
				date: new Date(input.date),
				description: input.description,
				type: input.type,
				dungeonMasterId: (dm || {}).id || null,
				is_dm_log: input.is_dm_log,
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
					id: input.logId
				},
				update: data,
				create: data
			});

			if (!log.id) throw new Error("Could not save log");

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

		return log
			? {
					...log,
					error: null,
					saving: true
			  }
			: {
					id: null,
					error: "Could not save log"
			  };
	} catch (error) {
		if (error instanceof Error) return { id: null, error: error.message };
		else return { id: null, error: "An unknown error has occurred." };
	}
}

export type DeleteLogResult = ReturnType<typeof deleteLog>;
export async function deleteLog(logId: string, userId?: string) {
	try {
		if (!userId) throw new Error("Not authenticated");
		const result = await prisma.$transaction(async (tx) => {
			const log = await tx.log.findUnique({
				where: {
					id: logId
				},
				include: {
					dm: true,
					character: true
				}
			});
			if (log?.character && log.character.userId !== userId) throw new Error("Not authorized");
			else if (log?.dm && log.dm.uid !== userId) throw new Error("Not authorized");
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
			await tx.log.delete({
				where: {
					id: logId
				}
			});
			return log;
		});
		return { id: result?.id || null, error: null };
	} catch (error) {
		if (error instanceof Error) return { id: null, error: error.message };
		else return { id: null, error: "Unknown error" };
	}
}

import { getLevels, getLogsSummary } from "$src/lib/entities";
import { prisma } from "$src/server/db";

import type { MagicItem, StoryAward } from "@prisma/client";

export async function getCharacter(characterId: string, includeLogs = true) {
	if (includeLogs) {
		const character = await prisma.character.findFirst({
			include: {
				user: true,
				logs: {
					include: {
						dm: true,
						magic_items_gained: true,
						magic_items_lost: true,
						story_awards_gained: true,
						story_awards_lost: true
					},
					orderBy: {
						date: "asc"
					}
				}
			},
			where: { id: characterId }
		});

		if (!character) return null;

		return {
			...character,
			...getLogsSummary(character.logs || [])
		};
	} else {
		const character = await prisma.character.findFirst({
			where: { id: characterId }
		});
		if (!character) return null;
		return {
			...character,
			...getLogsSummary([])
		};
	}
}

export type CharacterData = Exclude<Awaited<ReturnType<typeof getCharacter>>, null>;

export async function getCharacters(userId: string) {
	const characters = await prisma.character.findMany({
		include: {
			user: true,
			logs: {
				include: {
					dm: true,
					magic_items_gained: true,
					magic_items_lost: true,
					story_awards_gained: true,
					story_awards_lost: true
				},
				orderBy: {
					date: "asc"
				}
			}
		},
		where: { userId: userId }
	});

	return characters.map((character) => {
		const levels = getLevels(character.logs);
		const total_level = levels.total;
		const total_gold = character.logs.reduce((acc, log) => acc + log.gold, 0);
		const total_dtd = character.logs.reduce((acc, log) => acc + log.dtd, 0);
		const magic_items = character.logs.reduce((acc, log) => {
			acc.push(...log.magic_items_gained);
			log.magic_items_lost.forEach((magicItem) => {
				acc.splice(
					acc.findIndex((a) => a.id === magicItem.id),
					1
				);
			});
			return acc;
		}, [] as MagicItem[]);
		const story_awards = character.logs.reduce((acc, log) => {
			acc.push(...log.story_awards_gained);
			log.story_awards_lost.forEach((storyAward) => {
				acc.splice(
					acc.findIndex((a) => a.id === storyAward.id),
					1
				);
			});
			return acc;
		}, [] as StoryAward[]);

		return {
			...character,
			total_level,
			total_gold,
			total_dtd,
			magic_items,
			story_awards,
			log_levels: levels.log_levels,
			tier: total_level >= 17 ? 4 : total_level >= 11 ? 3 : total_level >= 5 ? 2 : 1
		};
	});
}

export type CharactersData = Awaited<ReturnType<typeof getCharacters>>;

export async function getCharacterLogs(characterId: string) {
	const logs = await prisma.log.findMany({
		include: {
			dm: true,
			magic_items_gained: true,
			magic_items_lost: true,
			story_awards_gained: true,
			story_awards_lost: true
		},
		orderBy: {
			date: "asc"
		},
		where: { characterId: characterId }
	});

	return getLogsSummary(logs);
}

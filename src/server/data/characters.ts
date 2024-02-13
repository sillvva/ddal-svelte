import { getLogsSummary } from "$lib/entities";
import { cache, mcache, type CacheKey } from "$src/server/cache";
import { prisma } from "$src/server/db";

export type CharacterData = Exclude<Awaited<ReturnType<typeof getCharacter>>, null>;
export async function getCharacter(characterId: string, includeLogs = true) {
	if (characterId === "new") return null;

	const character = await prisma.character.findFirst({
		include: {
			user: true
		},
		where: { id: characterId }
	});

	if (!character) return null;

	const logs = includeLogs
		? await prisma.log.findMany({
				where: { characterId: character.id },
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
			})
		: [];

	return {
		...character,
		...getLogsSummary(logs)
	};
}

export async function getCharacterCache(characterId: string, includeLogs = true) {
	return characterId !== "new"
		? await cache(() => getCharacter(characterId, includeLogs), ["character", characterId, includeLogs ? "logs" : "no-logs"])
		: null;
}

export async function getCharacterCaches(characterIds: string[]) {
	const keys: CacheKey[] = characterIds.map((id) => ["character", id, "logs"]);
	return await mcache<CharacterData>(async (keys, hits) => {
		const missingKeys = keys.filter((k) => !hits.find((h) => h.id === k[1]));
		const characterIds = missingKeys.map((k) => k[1]);

		const characters = await prisma.character.findMany({
			where: { id: { in: characterIds } },
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
			orderBy: {
				name: "asc"
			}
		});

		return characters
			.map((c) => ({ key: keys.find((k) => k[1] === c.id)!, value: { ...c, ...getLogsSummary(c.logs) } }))
			.filter((c) => c.key);
	}, keys);
}

export type CharactersData = Awaited<ReturnType<typeof getCharacters>>;
export async function getCharacters(userId: string) {
	return await prisma.character.findMany({
		where: { userId: userId },
		include: {
			user: true
		},
		orderBy: {
			name: "asc"
		}
	});
}

export async function getCharactersCache(userId: string) {
	return await cache(() => getCharacters(userId), ["characters", userId]);
}

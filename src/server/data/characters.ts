import { BLANK_CHARACTER } from "$lib/constants";
import { getLogsSummary } from "$lib/entities";
import { cache, mcache, type CacheKey } from "$server/cache";
import { q } from "$server/db";
import type { Character, User } from "$server/db/schema";
import type { LogData } from "./logs";

export type CharacterData = Exclude<Awaited<ReturnType<typeof getCharacter>>, null>;
export async function getCharacter(characterId: string, includeLogs = true) {
	if (characterId === "new") return null;

	const character: (Character & { user: User; logs: LogData[] }) | undefined = await (async () => {
		if (includeLogs) {
			return await q.characters.findFirst({
				with: {
					user: true,
					logs: {
						with: {
							dm: true,
							magicItemsGained: true,
							magicItemsLost: true,
							storyAwardsGained: true,
							storyAwardsLost: true
						},
						orderBy: (logs, { asc }) => asc(logs.date)
					}
				},
				where: (characters, { eq }) => eq(characters.id, characterId)
			});
		} else {
			return await q.characters
				.findFirst({
					with: {
						user: true
					},
					where: (characters, { eq }) => eq(characters.id, characterId)
				})
				.then((c) => c && { ...c, logs: [] });
		}
	})();

	if (!character) return null;

	return {
		...character,
		imageUrl: character.imageUrl || BLANK_CHARACTER,
		...getLogsSummary(character.logs)
	};
}

export async function getCharactersWithLogs(userId: string, includeLogs = true) {
	const characters = await q.characters.findMany({
		with: {
			user: true,
			logs: {
				with: {
					dm: true,
					magicItemsGained: true,
					magicItemsLost: true,
					storyAwardsGained: true,
					storyAwardsLost: true
				},
				orderBy: (logs, { asc }) => asc(logs.date)
			}
		},
		where: (characters, { eq, ne, and }) => and(eq(characters.userId, userId), ne(characters.name, "Placeholder"))
	});

	return characters.map((c) => ({
		...c,
		imageUrl: c.imageUrl || BLANK_CHARACTER,
		...getLogsSummary(c.logs, includeLogs)
	}));
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
		const characterIds = missingKeys.map((k) => k[1]).filter(Boolean);

		const characters = characterIds.length
			? await q.characters.findMany({
					with: {
						user: true,
						logs: {
							with: {
								dm: true,
								magicItemsGained: true,
								magicItemsLost: true,
								storyAwardsGained: true,
								storyAwardsLost: true
							},
							orderBy: (logs, { asc }) => asc(logs.date)
						}
					},
					where: (characters, { inArray }) => inArray(characters.id, characterIds),
					orderBy: (characters, { asc }) => asc(characters.name)
				})
			: [];

		return characters
			.map((c) => ({
				key: keys.find((k) => k[1] === c.id)!,
				value: { ...c, imageUrl: c.imageUrl || BLANK_CHARACTER, ...getLogsSummary(c.logs) }
			}))
			.filter((c) => c.key);
	}, keys);
}

export type CharactersData = Awaited<ReturnType<typeof getCharacters>>;
export async function getCharacters(userId: string) {
	return await q.characters.findMany({
		with: {
			user: true
		},
		where: (characters, { eq, ne, and }) => and(eq(characters.userId, userId), ne(characters.name, "Placeholder")),
		orderBy: (characters, { asc }) => asc(characters.name)
	});
}

export async function getCharactersCache(userId: string) {
	return await cache(() => getCharacters(userId), ["characters", userId]);
}

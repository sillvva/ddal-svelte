import { BLANK_CHARACTER } from "$lib/constants";
import { getLogsSummary } from "$lib/entities";
import type { CharacterId, UserId } from "$lib/schemas";
import { isDefined } from "$lib/util";
import { q } from "$server/db";
import { cache, mcache, type CacheKey } from "$server/kv/cache";
import { logIncludes } from "./logs";

export type CharacterData = Exclude<Awaited<ReturnType<typeof getCharacter>>, null>;
export async function getCharacter(characterId: CharacterId, includeLogs = true) {
	if (characterId === "new") return null;

	const character = await (async () => {
		if (includeLogs) {
			return await q.characters.findFirst({
				with: {
					user: true,
					logs: {
						with: logIncludes,
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

export async function getCharacterCache(characterId: CharacterId, includeLogs = true) {
	return characterId !== "new"
		? await cache(() => getCharacter(characterId, includeLogs), ["character", characterId, includeLogs ? "logs" : "no-logs"])
		: null;
}

export async function getCharactersWithLogs(userId: UserId, includeLogs = true) {
	const characters = await q.characters.findMany({
		with: {
			user: true,
			logs: {
				with: logIncludes,
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

export async function getCharacterCaches(characterIds: CharacterId[]) {
	const keys: CacheKey[] = characterIds.map((id) => ["character", id, "logs"]);
	return await mcache<CharacterData>(async (keys, hits) => {
		const missingKeys = keys.filter((k) => !hits.find((h) => h.id === k[1]));
		const characterIds = missingKeys.map((k) => k[1]).filter(isDefined) as CharacterId[];

		const characters = characterIds.length
			? await q.characters.findMany({
					with: {
						user: true,
						logs: {
							with: logIncludes,
							orderBy: (logs, { asc }) => asc(logs.date)
						}
					},
					where: (characters, { inArray }) => inArray(characters.id, characterIds),
					orderBy: (characters, { asc }) => asc(characters.name)
				})
			: [];

		return characters.map((c) => ({
			key: missingKeys.find((k) => k[1] === c.id)!,
			value: { ...c, imageUrl: c.imageUrl || BLANK_CHARACTER, ...getLogsSummary(c.logs) }
		}));
	}, keys);
}

export type CharactersData = Awaited<ReturnType<typeof getCharacters>>;
export async function getCharacters(userId: UserId) {
	return await q.characters.findMany({
		with: {
			user: true
		},
		where: (characters, { eq, ne, and }) => and(eq(characters.userId, userId), ne(characters.name, "Placeholder")),
		orderBy: (characters, { asc }) => asc(characters.name)
	});
}

export async function getCharactersCache(userId: UserId) {
	return await cache(() => getCharacters(userId), ["characters", userId]);
}

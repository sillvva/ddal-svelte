import { BLANK_CHARACTER } from "$lib/constants";
import { getLogsSummary } from "$lib/entities";
import type { CharacterId, UserId } from "$lib/schemas";
import { isDefined } from "$lib/util";
import { userIncludes } from "$server/actions/users";
import { cache, mcache, type CacheKey } from "$server/cache";
import { q } from "$server/db";
import { logIncludes } from "./logs";

export type CharacterData = NonNullable<Awaited<ReturnType<typeof getCharacter>>>;
export async function getCharacter(characterId: CharacterId, includeLogs = true) {
	if (characterId === "new") return undefined;

	const character = await q.characters.findFirst({
		with: {
			user: userIncludes,
			logs: {
				with: logIncludes,
				orderBy: (logs, { asc }) => asc(logs.date)
			}
		},
		where: (characters, { eq }) => eq(characters.id, characterId)
	});

	return (
		character && {
			...character,
			imageUrl: character.imageUrl || BLANK_CHARACTER,
			...getLogsSummary(character.logs, includeLogs)
		}
	);
}

export async function getCharacterCache(characterId: CharacterId, includeLogs = true) {
	return characterId !== "new"
		? await cache(() => getCharacter(characterId, includeLogs), ["character", characterId, includeLogs ? "logs" : "no-logs"])
		: undefined;
}

export async function getCharactersWithLogs(userId: UserId, includeLogs = true) {
	const characters = await q.characters.findMany({
		with: {
			user: userIncludes,
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
						user: userIncludes,
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
			user: userIncludes
		},
		where: (characters, { eq, ne, and }) => and(eq(characters.userId, userId), ne(characters.name, "Placeholder")),
		orderBy: (characters, { asc }) => asc(characters.name)
	});
}

export async function getCharactersCache(userId: UserId) {
	return await cache(() => getCharacters(userId), ["characters", userId]);
}

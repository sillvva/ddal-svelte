import { BLANK_CHARACTER } from "$lib/constants";
import { getLogsSummary } from "$lib/entities";
import { cache, mcache, type CacheKey } from "$server/cache";
import { q } from "$server/db";

export type CharacterData = Exclude<Awaited<ReturnType<typeof getCharacter>>, null>;
export async function getCharacter(characterId: string, includeLogs = true) {
	if (characterId === "new") return null;

	const character = await q.characters.findFirst({
		with: {
			user: true
		},
		where: (characters, { eq }) => eq(characters.id, characterId)
	});

	if (!character) return null;

	const logs = includeLogs
		? await q.logs.findMany({
				with: {
					dm: true,
					magic_items_gained: true,
					magic_items_lost: true,
					story_awards_gained: true,
					story_awards_lost: true
				},
				where: (logs, { eq }) => eq(logs.characterId, characterId),
				orderBy: (logs, { asc }) => asc(logs.date)
			})
		: [];

	return {
		...character,
		image_url: character.image_url || BLANK_CHARACTER,
		...getLogsSummary(logs)
	};
}

export async function getCharactersWithLogs(userId: string, includeLogs = true) {
	const characters = await q.characters.findMany({
		with: {
			user: true,
			logs: {
				with: {
					dm: true,
					magic_items_gained: true,
					magic_items_lost: true,
					story_awards_gained: true,
					story_awards_lost: true
				},
				orderBy: (logs, { asc }) => asc(logs.date)
			}
		},
		where: (characters, { eq, ne, and }) => and(eq(characters.userId, userId), ne(characters.name, "Placeholder"))
	});
	console.log(characters.map((c) => c.name));

	return characters.map((c) => ({
		...c,
		image_url: c.image_url || BLANK_CHARACTER,
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
		const characterIds = missingKeys.map((k) => k[1]);

		const characters = characterIds.length
			? await q.characters.findMany({
					with: {
						user: true,
						logs: {
							with: {
								dm: true,
								magic_items_gained: true,
								magic_items_lost: true,
								story_awards_gained: true,
								story_awards_lost: true
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
				value: { ...c, image_url: c.image_url || BLANK_CHARACTER, ...getLogsSummary(c.logs) }
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

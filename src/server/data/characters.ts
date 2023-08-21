import { getLogsSummary } from "$lib/entities";
import { prisma } from "$src/server/db";
import { cache, mcache } from "../cache";

export type CharacterData = Exclude<Awaited<ReturnType<typeof getCharacter>>, null>;
export async function getCharacter(characterId: string, includeLogs = true) {
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
	return await cache(() => getCharacter(characterId, includeLogs), ["character", characterId, includeLogs ? "logs" : "no-logs"]);
}

export async function getCharacterCaches(characterIds: Array<string>, includeLogs = true) {
	const keys: [string, ...string[]][] = characterIds.map((id) => ["character", id, includeLogs ? "logs" : "no-logs"]);
	return await mcache((tags) => getCharacter(tags[1], tags[2] == "logs"), keys);
}

export type CharactersData = Awaited<ReturnType<typeof getCharacters>>;
export async function getCharacters(userId: string) {
	return await prisma.character.findMany({
		where: { userId: userId }
	});
}

export async function getCharactersCache(userId: string) {
	return await cache(() => getCharacters(userId), ["characters", userId]);
}

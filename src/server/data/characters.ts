import { PlaceholderName } from "$lib/constants";
import { getLogsSummary, parseCharacter } from "$lib/entities";
import type { CharacterId, UserId } from "$lib/schemas";
import { q, type InferQueryResult } from "$server/db";
import { characterIncludes, extendedCharacterIncludes } from "$server/db/includes";

export type CharacterData = InferQueryResult<"characters", { with: typeof characterIncludes }>;
export type ExtendedCharacterData = InferQueryResult<"characters", { with: typeof extendedCharacterIncludes }>;
export interface FullCharacterData extends CharacterData, ReturnType<typeof getLogsSummary> {
	imageUrl: string;
}

export async function getCharacter(characterId: CharacterId, includeLogs = true): Promise<FullCharacterData | undefined> {
	if (characterId === "new") return undefined;

	const character = await q.characters.findFirst({
		with: extendedCharacterIncludes,
		where: {
			id: {
				eq: characterId
			}
		}
	});

	return character && parseCharacter(character, includeLogs);
}

export async function getCharactersWithLogs(userId: UserId, includeLogs = true): Promise<FullCharacterData[]> {
	const characters = await q.characters.findMany({
		with: extendedCharacterIncludes,
		where: {
			userId: {
				eq: userId
			},
			name: {
				NOT: PlaceholderName
			}
		}
	});

	return characters.map((c) => parseCharacter(c, includeLogs));
}

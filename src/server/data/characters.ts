import { PlaceholderName } from "$lib/constants";
import { getLogsSummary, parseCharacter } from "$lib/entities";
import type { CharacterId, UserId } from "$lib/schemas";
import type { Prettify } from "$lib/util";
import { q, type InferQueryModel } from "$server/db";
import { characterIncludes, extendedCharacterIncludes } from "./includes";

export type CharacterData = InferQueryModel<"characters", { with: typeof characterIncludes }>;
export type ExtendedCharacterData = InferQueryModel<"characters", { with: typeof extendedCharacterIncludes }>;
export type FullCharacterData = Prettify<
	Omit<ExtendedCharacterData, "imageUrl" | "logs"> & { imageUrl: string } & ReturnType<typeof getLogsSummary>
>;

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
	console.log(characters);
	return characters.map((c) => parseCharacter(c, includeLogs));
}

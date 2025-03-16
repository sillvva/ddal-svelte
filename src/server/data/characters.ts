import { PlaceholderName } from "$lib/constants";
import { getLogsSummary, parseCharacter } from "$lib/entities";
import type { CharacterId, UserId } from "$lib/schemas";
import { userIncludes } from "$server/actions/users";
import { q, type InferQueryModel, type QueryConfig } from "$server/db";
import type { Prettify } from "valibot";
import { logIncludes } from "./logs";

export const characterIncludes = {
	user: userIncludes
} as const satisfies QueryConfig<"characters">["with"];

export const extendedCharacterIncludes = {
	...characterIncludes,
	logs: {
		with: logIncludes,
		orderBy: {
			date: "asc"
		}
	}
} as const satisfies QueryConfig<"characters">["with"];

export type CharacterData = InferQueryModel<"characters", { with: typeof characterIncludes }>;
export type FullCharacterData = Prettify<
	Omit<CharacterData, "imageUrl" | "logs"> & { imageUrl: string } & ReturnType<typeof getLogsSummary>
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

	return characters.map((c) => parseCharacter(c, includeLogs));
}

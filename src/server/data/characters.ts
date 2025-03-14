import { BLANK_CHARACTER, PlaceholderName } from "$lib/constants";
import { getLogsSummary } from "$lib/entities";
import type { CharacterId, UserId } from "$lib/schemas";
import { userIncludes } from "$server/actions/users";
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
				orderBy: {
					date: "asc"
				}
			}
		},
		where: {
			id: {
				eq: characterId
			}
		}
	});

	return (
		character && {
			...character,
			imageUrl: character.imageUrl || BLANK_CHARACTER,
			...getLogsSummary(character.logs, includeLogs)
		}
	);
}

export async function getCharactersWithLogs(userId: UserId, includeLogs = true) {
	const characters = await q.characters.findMany({
		with: {
			user: userIncludes,
			logs: {
				with: logIncludes,
				orderBy: {
					date: "asc"
				}
			}
		},
		where: {
			userId: {
				eq: userId
			},
			name: {
				NOT: PlaceholderName
			}
		}
	});

	return characters.map((c) => ({
		...c,
		imageUrl: c.imageUrl || BLANK_CHARACTER,
		...getLogsSummary(c.logs, includeLogs)
	}));
}

export type CharactersData = Awaited<ReturnType<typeof getCharacters>>;
export async function getCharacters(userId: UserId) {
	return await q.characters.findMany({
		with: {
			user: userIncludes
		},
		where: {
			userId: {
				eq: userId
			},
			name: {
				NOT: PlaceholderName
			}
		},
		orderBy: {
			name: "asc"
		}
	});
}

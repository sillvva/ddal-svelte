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

export async function getCharactersWithLogs(userId: UserId, includeLogs = true) {
	const characters = await q.characters.findMany({
		with: {
			user: userIncludes,
			logs: {
				with: logIncludes,
				orderBy: (logs, { asc }) => asc(logs.date)
			}
		},
		where: (characters, { eq, ne, and }) => and(eq(characters.userId, userId), ne(characters.name, PlaceholderName))
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
		where: (characters, { eq, ne, and }) => and(eq(characters.userId, userId), ne(characters.name, PlaceholderName)),
		orderBy: (characters, { asc }) => asc(characters.name)
	});
}

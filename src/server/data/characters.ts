import { PlaceholderName } from "$lib/constants";
import { getLogsSummary, parseCharacter } from "$lib/entities";
import type { CharacterId, UserId } from "$lib/schemas";
import { type InferQueryResult } from "$server/db";
import { DBService, FetchError } from "$server/db/effect";
import { characterIncludes, extendedCharacterIncludes } from "$server/db/includes";
import { Effect } from "effect";

export type CharacterData = InferQueryResult<"characters", { with: typeof characterIncludes }>;
export type ExtendedCharacterData = InferQueryResult<"characters", { with: typeof extendedCharacterIncludes }>;
export interface FullCharacterData extends CharacterData, ReturnType<typeof getLogsSummary> {
	imageUrl: string;
}

class FetchCharacterError extends FetchError {}
function createCharacterError(err: unknown): FetchCharacterError {
	return FetchCharacterError.from(err);
}

export function getCharacter(characterId: CharacterId, includeLogs = true) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		return yield* Effect.tryPromise({
			try: () =>
				db.query.characters.findFirst({
					with: includeLogs ? extendedCharacterIncludes : characterIncludes,
					where: { id: { eq: characterId } }
				}),
			catch: createCharacterError
		}).pipe(Effect.andThen((character) => character && parseCharacter({ logs: [], ...character })));
	});
}

export function getUserCharacters(userId: UserId, includeLogs = true) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		return yield* Effect.tryPromise({
			try: () =>
				db.query.characters.findMany({
					with: includeLogs ? extendedCharacterIncludes : characterIncludes,
					where: { userId: { eq: userId }, name: { NOT: PlaceholderName } }
				}),
			catch: createCharacterError
		}).pipe(Effect.map((characters) => characters.map((character) => parseCharacter({ logs: [], ...character }))));
	});
}

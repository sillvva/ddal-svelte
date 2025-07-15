import { PlaceholderName } from "$lib/constants";
import { getLogsSummary, parseCharacter } from "$lib/entities";
import type { CharacterId, EditCharacterSchema, NewCharacterSchema, UserId } from "$lib/schemas";
import { buildConflictUpdateColumns, type Database, type InferQueryResult, type Transaction } from "$server/db";
import { characterIncludes, extendedCharacterIncludes } from "$server/db/includes";
import { characters, logs, type Character } from "$server/db/schema";
import { and, eq, exists } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";
import { DBService, debugSet, FetchError, FormError, Log } from ".";

export class FetchCharacterError extends FetchError {}
function createFetchError(err: unknown): FetchCharacterError {
	return FetchCharacterError.from(err);
}

export class SaveCharacterError extends FormError<EditCharacterSchema> {}
function createSaveError(err: unknown): SaveCharacterError {
	return SaveCharacterError.from(err);
}

export type CharacterData = InferQueryResult<"characters", { with: typeof characterIncludes }>;
export type ExtendedCharacterData = InferQueryResult<"characters", { with: typeof extendedCharacterIncludes }>;
export interface FullCharacterData extends CharacterData, ReturnType<typeof getLogsSummary> {
	imageUrl: string;
}

interface CharacterApiImpl {
	readonly db: Database | Transaction;
	readonly get: {
		readonly character: (
			characterId: CharacterId,
			includeLogs?: boolean
		) => Effect.Effect<FullCharacterData | undefined, FetchCharacterError>;
		readonly userCharacters: (userId: UserId, includeLogs?: boolean) => Effect.Effect<FullCharacterData[], FetchCharacterError>;
	};
	readonly set: {
		readonly save: (
			characterId: CharacterId,
			userId: UserId,
			data: NewCharacterSchema
		) => Effect.Effect<Character, SaveCharacterError>;
		readonly delete: (characterId: CharacterId, userId: UserId) => Effect.Effect<{ id: CharacterId }, SaveCharacterError>;
	};
}

export class CharacterService extends Effect.Service<CharacterService>()("CharacterService", {
	scoped: Effect.gen(function* () {
		const { db } = yield* DBService;

		const impl: CharacterApiImpl = {
			db,
			get: {
				character: (characterId, includeLogs = true) =>
					Effect.gen(function* () {
						yield* Log.info("CharacterApiLive.getCharacter", { characterId, includeLogs });

						return yield* Effect.tryPromise({
							try: () =>
								db.query.characters.findFirst({
									with: includeLogs ? extendedCharacterIncludes : characterIncludes,
									where: { id: { eq: characterId } }
								}),
							catch: createFetchError
						}).pipe(Effect.andThen((character) => character && parseCharacter({ logs: [], ...character })));
					}),

				userCharacters: (userId, includeLogs = true) =>
					Effect.gen(function* () {
						yield* Log.info("CharacterApiLive.getUserCharacters", { userId, includeLogs });

						return yield* Effect.tryPromise({
							try: () =>
								db.query.characters.findMany({
									with: includeLogs ? extendedCharacterIncludes : characterIncludes,
									where: { userId: { eq: userId }, name: { NOT: PlaceholderName } }
								}),
							catch: createFetchError
						}).pipe(Effect.map((characters) => characters.map((character) => parseCharacter({ logs: [], ...character }))));
					})
			},

			set: {
				save: (characterId, userId, data) =>
					Effect.gen(function* () {
						yield* Log.info("CharacterApiLive.saveCharacter", { characterId, userId });
						yield* Log.debug("CharacterApiLive.saveCharacter", data);

						if (!characterId) yield* new SaveCharacterError("No character ID provided", { status: 400 });

						return yield* Effect.tryPromise({
							try: () =>
								db
									.insert(characters)
									.values({
										...data,
										id: characterId === "new" ? undefined : characterId,
										userId
									})
									.onConflictDoUpdate({
										target: characters.id,
										set: buildConflictUpdateColumns(characters, ["id", "userId", "createdAt"], true),
										where: eq(characters.userId, userId)
									})
									.returning(),
							catch: createSaveError
						}).pipe(
							Effect.flatMap((characters) =>
								isTupleOf(characters, 1)
									? Effect.succeed(characters[0])
									: Effect.fail(new SaveCharacterError("Failed to save character"))
							)
						);
					}),

				delete: (characterId, userId) =>
					Effect.gen(function* () {
						yield* Log.info("CharacterApiLive.deleteCharacter", { characterId, userId });

						return yield* Effect.tryPromise({
							try: () =>
								db.transaction(async (tx) => {
									await tx
										.update(logs)
										.set({ characterId: null, appliedDate: null })
										.where(
											and(
												eq(logs.characterId, characterId),
												eq(logs.isDmLog, true),
												exists(
													db
														.select()
														.from(characters)
														.where(and(eq(characters.id, characterId), eq(characters.userId, userId)))
												)
											)
										);
									return await tx.delete(characters).where(eq(characters.id, characterId)).returning({ id: characters.id });
								}),
							catch: createSaveError
						}).pipe(
							Effect.flatMap((result) =>
								isTupleOf(result, 1)
									? Effect.succeed(result[0])
									: Effect.fail(new SaveCharacterError("Character not found", { status: 404 }))
							)
						);
					})
			}
		};

		return impl;
	}),
	dependencies: [DBService.Default()]
}) {}

export const CharacterTx = (tx: Transaction) =>
	CharacterService.DefaultWithoutDependencies.pipe(Layer.provide(DBService.Default(tx)));

export function withCharacter<R, E extends FetchCharacterError | SaveCharacterError>(
	impl: (service: CharacterApiImpl) => Effect.Effect<R, E>
) {
	return Effect.gen(function* () {
		const CharacterApi = yield* CharacterService;
		const result = yield* impl(CharacterApi);

		yield* debugSet("CharacterService", impl, result);

		return result;
	}).pipe(Effect.provide(CharacterService.Default));
}

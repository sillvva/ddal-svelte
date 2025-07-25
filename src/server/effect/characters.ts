import { PlaceholderName } from "$lib/constants";
import { getLogsSummary, parseCharacter } from "$lib/entities";
import type { CharacterId, EditCharacterSchema, NewCharacterSchema, UserId } from "$lib/schemas";
import { buildConflictUpdateColumns, DBService, type Database, type InferQueryResult, type Transaction } from "$server/db";
import { characterIncludes, extendedCharacterIncludes } from "$server/db/includes";
import { characters, logs, type Character } from "$server/db/schema";
import { and, eq, exists } from "drizzle-orm";
import { Data, Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";
import { debugSet, FormError, Log, type ErrorParams } from ".";

export class CharacterNotFoundError extends Data.TaggedError("CharacterNotFoundError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Character not found", status: 404, cause: err });
	}
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
		readonly character: (characterId: CharacterId, includeLogs?: boolean) => Effect.Effect<FullCharacterData | undefined>;
		readonly userCharacters: (userId: UserId, includeLogs?: boolean) => Effect.Effect<FullCharacterData[]>;
	};
	readonly set: {
		readonly save: (
			characterId: CharacterId | "new",
			userId: UserId,
			data: NewCharacterSchema
		) => Effect.Effect<Character, SaveCharacterError>;
		readonly delete: (characterId: CharacterId, userId: UserId) => Effect.Effect<{ id: CharacterId }, SaveCharacterError>;
	};
}

export class CharacterService extends Effect.Service<CharacterService>()("CharacterService", {
	effect: Effect.fn("CharacterService")(function* () {
		const { db } = yield* DBService;

		const impl: CharacterApiImpl = {
			db,
			get: {
				character: Effect.fn("CharacterService.getCharacter")(function* (characterId, includeLogs = true) {
					yield* Log.info("CharacterService.getCharacter", { characterId, includeLogs });

					return yield* Effect.promise(() =>
						db.query.characters.findFirst({
							with: includeLogs ? extendedCharacterIncludes : characterIncludes,
							where: { id: { eq: characterId } }
						})
					).pipe(Effect.andThen((character) => character && parseCharacter({ logs: [], ...character })));
				}),

				userCharacters: Effect.fn("CharacterService.getUserCharacters")(function* (userId, includeLogs = true) {
					yield* Log.info("CharacterService.getUserCharacters", { userId, includeLogs });

					return yield* Effect.promise(() =>
						db.query.characters.findMany({
							with: includeLogs ? extendedCharacterIncludes : characterIncludes,
							where: { userId: { eq: userId }, name: { NOT: PlaceholderName } }
						})
					).pipe(Effect.map((characters) => characters.map((character) => parseCharacter({ logs: [], ...character }))));
				})
			},
			set: {
				save: Effect.fn("CharacterService.saveCharacter")(function* (characterId, userId, data) {
					yield* Log.info("CharacterService.saveCharacter", { characterId, userId });
					yield* Log.debug("CharacterService.saveCharacter", data);

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

				delete: Effect.fn("CharacterService.deleteCharacter")(function* (characterId, userId) {
					yield* Log.info("CharacterService.deleteCharacter", { characterId, userId });

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
								return await tx
									.delete(characters)
									.where(and(eq(characters.id, characterId), eq(characters.userId, userId)))
									.returning({ id: characters.id });
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
	CharacterService.DefaultWithoutDependencies().pipe(Layer.provide(DBService.Default(tx)));

export const withCharacter = Effect.fn("withCharacter")(
	function* <R, E extends SaveCharacterError>(impl: (service: CharacterApiImpl) => Effect.Effect<R, E>) {
		const CharacterApi = yield* CharacterService;
		const result = yield* impl(CharacterApi);

		yield* debugSet("CharacterService", impl, result);

		return result;
	},
	(effect) => effect.pipe(Effect.provide(CharacterService.Default()))
);

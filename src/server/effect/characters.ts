import { PlaceholderName } from "$lib/constants";
import { getLogsSummary, parseCharacter } from "$lib/entities";
import type { CharacterId, EditCharacterSchema, NewCharacterSchema, UserId } from "$lib/schemas";
import { buildConflictUpdateColumns, db, type Database, type InferQueryResult, type Transaction } from "$server/db";
import { characterIncludes, extendedCharacterIncludes } from "$server/db/includes";
import { characters, logs, type Character } from "$server/db/schema";
import { and, eq, exists } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { DBService, FetchError, FormError, Logs, withLiveDB } from ".";

class FetchCharacterError extends FetchError {}
function createFetchError(err: unknown): FetchCharacterError {
	return FetchCharacterError.from(err);
}

class SaveCharacterError extends FormError<EditCharacterSchema> {}
function createSaveError(err: unknown): SaveCharacterError {
	return SaveCharacterError.from(err);
}

export type CharacterData = InferQueryResult<"characters", { with: typeof characterIncludes }>;
export type ExtendedCharacterData = InferQueryResult<"characters", { with: typeof extendedCharacterIncludes }>;
export interface FullCharacterData extends CharacterData, ReturnType<typeof getLogsSummary> {
	imageUrl: string;
}

interface CharacterApiImpl {
	readonly getCharacter: (
		characterId: CharacterId,
		includeLogs?: boolean
	) => Effect.Effect<FullCharacterData | undefined, FetchCharacterError>;
	readonly getUserCharacters: (userId: UserId, includeLogs?: boolean) => Effect.Effect<FullCharacterData[], FetchCharacterError>;
	readonly saveCharacter: (
		characterId: CharacterId,
		userId: UserId,
		data: NewCharacterSchema
	) => Effect.Effect<Character, SaveCharacterError>;
	readonly deleteCharacter: (
		characterId: CharacterId,
		userId: UserId
	) => Effect.Effect<
		{
			id: CharacterId;
		}[],
		SaveCharacterError
	>;
}

export class CharacterApi extends Context.Tag("CharacterApi")<CharacterApi, CharacterApiImpl>() {}

const CharacterApiLive = Layer.effect(
	CharacterApi,
	Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		const impl: CharacterApiImpl = {
			getCharacter: (characterId, includeLogs = true) =>
				Effect.gen(function* () {
					yield* Logs.logInfo("getCharacter", characterId, includeLogs);
					return yield* Effect.tryPromise({
						try: () =>
							db.query.characters.findFirst({
								with: includeLogs ? extendedCharacterIncludes : characterIncludes,
								where: { id: { eq: characterId } }
							}),
						catch: createFetchError
					}).pipe(Effect.andThen((character) => character && parseCharacter({ logs: [], ...character })));
				}),

			getUserCharacters: (userId, includeLogs = true) =>
				Effect.gen(function* () {
					yield* Logs.logInfo("getUserCharacters", userId, includeLogs);
					return yield* Effect.tryPromise({
						try: () =>
							db.query.characters.findMany({
								with: includeLogs ? extendedCharacterIncludes : characterIncludes,
								where: { userId: { eq: userId }, name: { NOT: PlaceholderName } }
							}),
						catch: createFetchError
					}).pipe(Effect.map((characters) => characters.map((character) => parseCharacter({ logs: [], ...character }))));
				}),

			saveCharacter: (characterId, userId, data) =>
				Effect.gen(function* () {
					yield* Logs.logInfo("saveCharacter", characterId, userId);
					yield* Logs.logDebugJson(data);
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
						Effect.map((characters) => characters[0]),
						Effect.flatMap((character) =>
							character ? Effect.succeed(character) : Effect.fail(new SaveCharacterError("Failed to save character"))
						)
					);
				}),

			deleteCharacter: (characterId, userId) =>
				Effect.gen(function* () {
					yield* Logs.logInfo("deleteCharacter", characterId, userId);
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
							result ? Effect.succeed(result) : Effect.fail(new SaveCharacterError("Character not found", { status: 404 }))
						)
					);
				})
		};

		return impl;
	})
);

export const CharacterLive = (dbOrTx: Database | Transaction = db) => CharacterApiLive.pipe(Layer.provide(withLiveDB(dbOrTx)));

export function withCharacter<R, E extends FetchCharacterError | SaveCharacterError>(
	impl: (service: CharacterApiImpl) => Effect.Effect<R, E>,
	dbOrTx: Database | Transaction = db
) {
	return Effect.gen(function* () {
		const CharacterService = yield* CharacterApi;
		return yield* impl(CharacterService);
	}).pipe(Effect.provide(CharacterLive(dbOrTx)));
}

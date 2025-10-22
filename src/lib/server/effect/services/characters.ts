import { PlaceholderName } from "$lib/constants";
import { getLogsSummary, parseCharacter } from "$lib/entities";
import type { CharacterId, CharacterSchema, UserId } from "$lib/schemas";
import {
	buildConflictUpdateColumns,
	DBService,
	runQuery,
	TransactionError,
	type DrizzleError,
	type InferQueryResult,
	type Transaction
} from "$lib/server/db";
import { characterIncludes } from "$lib/server/db/includes";
import { characters, logs, type Character } from "$lib/server/db/schema";
import type { ErrorParams } from "$lib/server/effect/errors";
import { AppLog } from "$lib/server/effect/logging";
import { and, eq, exists } from "drizzle-orm";
import { Data, Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";

export class CharacterNotFoundError extends Data.TaggedError("CharacterNotFoundError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Character not found", status: 404, cause: err });
	}
}

export class SaveCharacterError extends Data.TaggedError("SaveCharacterError")<ErrorParams> {
	constructor(message: string, err?: unknown) {
		super({ message, status: 404, cause: err });
	}
}

export class DeleteCharacterError extends Data.TaggedError("DeleteCharacterError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Unable to delete character", status: 404, cause: err });
	}
}

export type CharacterData = InferQueryResult<"characters", { with: ReturnType<typeof characterIncludes> }>;
export interface FullCharacterData extends Omit<CharacterData, "logs">, ReturnType<typeof getLogsSummary> {
	imageUrl: string;
}

interface CharacterApiImpl {
	readonly get: {
		readonly one: (
			characterId: CharacterId,
			includeLogs?: boolean
		) => Effect.Effect<FullCharacterData, DrizzleError | CharacterNotFoundError>;
		readonly all: (
			userId: UserId,
			options?: { characterId?: CharacterId; includeLogs?: boolean }
		) => Effect.Effect<FullCharacterData[], DrizzleError>;
	};
	readonly set: {
		readonly save: (data: CharacterSchema, userId: UserId) => Effect.Effect<Character, SaveCharacterError | DrizzleError>;
		readonly delete: (
			characterId: CharacterId,
			userId: UserId
		) => Effect.Effect<{ id: CharacterId }, DeleteCharacterError | DrizzleError | TransactionError>;
	};
}

export class CharacterService extends Effect.Service<CharacterService>()("CharacterService", {
	dependencies: [DBService.Default()],
	effect: Effect.fn("CharacterService")(function* () {
		const { db, transaction } = yield* DBService;

		const impl: CharacterApiImpl = {
			get: {
				one: Effect.fn("CharacterService.get.one")(function* (characterId, includeLogs = true) {
					return yield* runQuery(
						db.query.characters.findFirst({
							with: characterIncludes(includeLogs),
							where: { id: { eq: characterId } }
						})
					).pipe(
						Effect.flatMap((character) =>
							character ? Effect.succeed(parseCharacter(character)) : Effect.fail(new CharacterNotFoundError())
						),
						Effect.tapError(() => AppLog.debug("CharacterService.get.one", { characterId, includeLogs }))
					);
				}),

				all: Effect.fn("CharacterService.get.all")(function* (userId, { characterId, includeLogs = true } = {}) {
					return yield* runQuery(
						db.query.characters.findMany({
							with: characterIncludes(includeLogs),
							where: {
								userId: { eq: userId },
								name: { NOT: PlaceholderName },
								...(characterId && { id: { eq: characterId } })
							}
						})
					).pipe(
						Effect.map((characters) => characters.map(parseCharacter)),
						Effect.tapError(() => AppLog.debug("CharacterService.get.all", { userId, includeLogs }))
					);
				})
			},
			set: {
				save: Effect.fn("CharacterService.set.save")(function* (data, userId) {
					if (!data.id) yield* new SaveCharacterError("No character ID provided", { status: 400 });

					return yield* runQuery(
						db
							.insert(characters)
							.values({
								...data,
								id: data.id === "new" ? undefined : data.id,
								userId
							})
							.onConflictDoUpdate({
								target: characters.id,
								set: buildConflictUpdateColumns(characters, ["id", "userId", "createdAt"], true),
								where: eq(characters.userId, userId)
							})
							.returning()
					).pipe(
						Effect.flatMap((characters) =>
							isTupleOf(characters, 1)
								? Effect.succeed(characters[0])
								: Effect.fail(new SaveCharacterError("Failed to save character"))
						),
						Effect.tap((result) => AppLog.info("CharacterService.set.save", { userId, result })),
						Effect.tapError(() => AppLog.debug("CharacterService.set.save", { userId, data }))
					);
				}),

				delete: Effect.fn("CharacterService.set.delete")(function* (characterId, userId) {
					return yield* transaction(
						Effect.fn("CharacterService.set.delete.transaction")(function* (tx) {
							yield* runQuery(
								tx
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
									)
							);

							return yield* runQuery(
								tx
									.delete(characters)
									.where(and(eq(characters.id, characterId), eq(characters.userId, userId)))
									.returning({ id: characters.id })
							);
						})
					).pipe(
						Effect.flatMap((result) =>
							isTupleOf(result, 1) ? Effect.succeed(result[0]) : Effect.fail(new DeleteCharacterError())
						),
						Effect.tap((result) => AppLog.info("CharacterService.set.delete", { characterId, userId, result })),
						Effect.tapError(() => AppLog.debug("CharacterService.set.delete", { characterId, userId }))
					);
				})
			}
		};

		return impl;
	})
}) {}

export const CharacterTx = (tx: Transaction) =>
	CharacterService.DefaultWithoutDependencies().pipe(Layer.provide(DBService.Default(tx)));

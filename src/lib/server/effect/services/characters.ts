import { PlaceholderName } from "$lib/constants";
import { getLogsSummary, parseCharacter } from "$lib/entities";
import type { CharacterId, EditCharacterSchema, NewCharacterSchema, UserId } from "$lib/schemas";
import {
	buildConflictUpdateColumns,
	DBService,
	runQuery,
	TransactionError,
	type Database,
	type DrizzleError,
	type InferQueryResult,
	type Transaction
} from "$lib/server/db";
import { characterIncludes } from "$lib/server/db/includes";
import { characters, logs, type Character } from "$lib/server/db/schema";
import type { ErrorParams } from "$lib/server/effect/errors";
import { FormError } from "$lib/server/effect/forms";
import { AppLog } from "$lib/server/effect/logging";
import { and, eq, exists } from "drizzle-orm";
import { Data, Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";

export class CharacterNotFoundError extends Data.TaggedError("CharacterNotFoundError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Character not found", status: 404, cause: err });
	}
}

export class SaveCharacterError extends FormError<EditCharacterSchema> {}

export class DeleteCharacterError extends FormError<{ id: CharacterId }> {
	constructor(err?: unknown) {
		super("Unable to delete character", { status: 500, cause: err });
	}
}

export type CharacterData = InferQueryResult<"characters", { with: ReturnType<typeof characterIncludes> }>;
export interface FullCharacterData extends Omit<CharacterData, "logs">, ReturnType<typeof getLogsSummary> {
	imageUrl: string;
}

interface CharacterApiImpl {
	readonly db: Database | Transaction;
	readonly get: {
		readonly character: (
			characterId: CharacterId,
			includeLogs?: boolean
		) => Effect.Effect<FullCharacterData, DrizzleError | CharacterNotFoundError>;
		readonly userCharacters: (
			userId: UserId,
			options?: { characterId?: CharacterId | null; includeLogs?: boolean }
		) => Effect.Effect<FullCharacterData[], DrizzleError>;
	};
	readonly set: {
		readonly save: (
			characterId: CharacterId | "new",
			userId: UserId,
			data: NewCharacterSchema
		) => Effect.Effect<Character, SaveCharacterError | DrizzleError>;
		readonly delete: (
			characterId: CharacterId,
			userId: UserId
		) => Effect.Effect<{ id: CharacterId }, DeleteCharacterError | TransactionError>;
	};
}

export class CharacterService extends Effect.Service<CharacterService>()("CharacterService", {
	effect: Effect.fn("CharacterService")(function* () {
		const { db, transaction } = yield* DBService;

		const impl: CharacterApiImpl = {
			db,
			get: {
				character: Effect.fn("CharacterService.get.character")(function* (characterId, includeLogs = true) {
					return yield* runQuery(
						db.query.characters.findFirst({
							with: characterIncludes(includeLogs),
							where: { id: { eq: characterId } }
						})
					).pipe(
						Effect.flatMap((character) =>
							character ? Effect.succeed(parseCharacter(character)) : Effect.fail(new CharacterNotFoundError())
						),
						Effect.tapError(() => AppLog.debug("CharacterService.get.character", { characterId, includeLogs }))
					);
				}),

				userCharacters: Effect.fn("CharacterService.get.userCharacters")(function* (
					userId,
					{ characterId, includeLogs = true } = {}
				) {
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
						Effect.tapError(() => AppLog.debug("CharacterService.get.userCharacters", { userId, includeLogs }))
					);
				})
			},
			set: {
				save: Effect.fn("CharacterService.set.save")(function* (characterId, userId, data) {
					if (!characterId) yield* new SaveCharacterError("No character ID provided", { status: 400 });

					return yield* runQuery(
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
							.returning()
					).pipe(
						Effect.flatMap((characters) =>
							isTupleOf(characters, 1)
								? Effect.succeed(characters[0])
								: Effect.fail(new SaveCharacterError("Failed to save character"))
						),
						Effect.tap((result) => AppLog.info("CharacterService.set.save", { characterId, userId, result })),
						Effect.tapError(() => AppLog.debug("CharacterService.set.save", { characterId, userId, data }))
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
	}),
	dependencies: [DBService.Default()]
}) {}

export const CharacterTx = (tx: Transaction) =>
	CharacterService.DefaultWithoutDependencies().pipe(Layer.provide(DBService.Default(tx)));

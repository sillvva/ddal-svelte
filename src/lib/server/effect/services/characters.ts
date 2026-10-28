import { PlaceholderName } from "#lib/constants.js";
import { getLogsSummary, parseCharacter } from "#lib/entities.js";
import { imagePublicUrl } from "#lib/images/object-key.js";
import type { CharacterId, CharacterSchema, UserId } from "#lib/schemas.js";
import { characterIncludes } from "#lib/server/db/includes.js";
import {
	buildConflictUpdateColumns,
	DBService,
	runQuery,
	type InferQueryResult,
	type Transaction
} from "#lib/server/db/index.js";
import { characters, logs } from "#lib/server/db/schema.js";
import type { ErrorParams } from "#lib/server/effect/errors.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { serializeError } from "#lib/server/effect/serialize-error.js";
import { ImageUploadError } from "#lib/server/images/errors.js";
import {
	assertPortraitQuota,
	clearScheduledDeletions,
	collectCharacterKeys,
	lockPortraitUser,
	ownedBytesForSave,
	scheduleDeletions
} from "#lib/server/images/portrait-db.js";
import { getRequestEvent } from "$app/server";
import { R2_PUBLIC_URL } from "$app/env/public";
import { isTupleOf } from "@sillvva/utils";
import { and, eq, exists } from "drizzle-orm";
import { Context, Data, Effect, Layer } from "effect";
import { addMissingTimeZones } from "./logs";
import { copyVerifiedStage, StorageService, type StagedCharacterImage } from "./storage";

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

export class CharacterService extends Context.Service<CharacterService>()("CharacterService", {
	make: Effect.fn("CharacterService")(function* () {
		const { db, transaction } = yield* DBService;

		return {
			/**
			 * Queries
			 */

			get: {
				one: Effect.fn("CharacterService.get.one")(function* (characterId: CharacterId, includeLogs = true) {
					return yield* runQuery(
						db.query.characters.findFirst({
							with: characterIncludes(includeLogs),
							where: {
								id: { eq: characterId },
								user: { banned: { eq: false } }
							}
						})
					).pipe(
						Effect.flatMap((character) =>
							character ? Effect.succeed(parseCharacter(character)) : Effect.fail(new CharacterNotFoundError())
						),
						Effect.tapError((error) =>
							AppLog.debug("CharacterService.get.one", { characterId, includeLogs, error: serializeError(error) })
						)
					);
				}),

				all: Effect.fn("CharacterService.get.all")(function* (
					userId: UserId,
					{ characterId, includeLogs = true }: { characterId?: CharacterId; includeLogs?: boolean } = {}
				) {
					const characters = yield* runQuery(
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
						Effect.tapError((error) =>
							AppLog.debug("CharacterService.get.all", { userId, includeLogs, error: serializeError(error) })
						)
					);

					const event = getRequestEvent();
					const timezone = event.locals.app.settings.timezone;
					if (timezone) {
						const logRecords = characters.flatMap((character) => character.logs);
						yield* addMissingTimeZones(db, timezone, logRecords);
					}

					return characters;
				}),

				select: Effect.fn("CharacterService.get.select")(function* (userId: UserId) {
					return yield* runQuery(
						db.query.characters.findMany({
							columns: {
								id: true,
								name: true
							},
							where: {
								userId: { eq: userId },
								name: { NOT: PlaceholderName }
							}
						})
					).pipe(
						Effect.tapError((error) => AppLog.debug("CharacterService.get.select", { userId, error: serializeError(error) }))
					);
				})
			},

			/**
			 * Mutations
			 */

			save: Effect.fn("CharacterService.save")(function* (
				data: CharacterSchema,
				userId: UserId,
				staged: StagedCharacterImage | null = null
			) {
				if (!data.id) yield* new SaveCharacterError("No character ID provided", { status: 400 });

				let copiedKey: string | null = null;
				return yield* transaction(
					Effect.fn(function* (tx) {
						yield* lockPortraitUser(tx, userId);
						if (staged && imagePublicUrl(staged.to, R2_PUBLIC_URL) !== data.imageUrl) {
							return yield* new ImageUploadError("Upload that image again before saving.");
						}
						if (staged) {
							yield* copyVerifiedStage(tx, userId, data.id, staged);
							copiedKey = staged.to;
						}

						const imageBytes = yield* ownedBytesForSave(tx, userId, data.id, data.imageUrl);
						yield* assertPortraitQuota(tx, userId, data.id, imageBytes.bytes);
						if (imageBytes.previousKey) yield* scheduleDeletions(tx, [imageBytes.previousKey]);
						if (imageBytes.nextKey) yield* clearScheduledDeletions(tx, [imageBytes.nextKey]);

						return yield* runQuery(
							tx
								.insert(characters)
								.values({
									...data,
									imageBytes: imageBytes.bytes,
									id: data.id === "new" ? undefined : data.id,
									userId
								})
								.onConflictDoUpdate({
									target: characters.id,
									set: buildConflictUpdateColumns(characters, ["id", "userId", "createdAt"], true),
									where: eq(characters.userId, userId)
								})
								.returning()
						);
					})
				).pipe(
					Effect.flatMap((saved) =>
						isTupleOf(saved, 1) ? Effect.succeed(saved[0]) : Effect.fail(new SaveCharacterError("Failed to save character"))
					),
					Effect.tap((result) => AppLog.info("CharacterService.save", { userId, result })),
					Effect.tapError(() => {
						const orphanKey = copiedKey;
						if (!orphanKey) return Effect.void;
						return Effect.gen(function* () {
							const Storage = yield* StorageService;
							yield* Storage.abandonStagedObject(userId, orphanKey);
						}).pipe(
							Effect.catch((error) =>
								AppLog.error("CharacterService.save staged cleanup", {
									message: error.message,
									error: serializeError(error)
								})
							)
						);
					}),
					Effect.tapError((error) => AppLog.debug("CharacterService.save", { userId, data, error: serializeError(error) }))
				);
			}),

			delete: Effect.fn("CharacterService.delete")(function* (characterId: CharacterId, userId: UserId) {
				return yield* transaction(
					Effect.fn(function* (tx) {
						const keys = yield* collectCharacterKeys(tx, userId, characterId);
						yield* scheduleDeletions(tx, keys);

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
					Effect.tap((result) => AppLog.info("CharacterService.delete", { characterId, userId, result })),
					Effect.tapError((error) =>
						AppLog.debug("CharacterService.delete", { characterId, userId, error: serializeError(error) })
					)
				);
			})
		};
	})()
}) {
	static readonly layer = Layer.effect(this, this.make);
}

export const CharacterTx = (tx: Transaction) => CharacterService.layer.pipe(Layer.provide(DBService.layer(tx)));

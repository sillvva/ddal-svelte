import { type CharacterId, type EditCharacterSchema, type NewCharacterSchema, type UserId } from "$lib/schemas";
import { buildConflictUpdateColumns } from "$server/db";
import { DBService, FormError } from "$server/db/effect";
import { characters, logs } from "$server/db/schema";
import { and, eq, exists } from "drizzle-orm";
import { Effect } from "effect";

class SaveCharacterError extends FormError<EditCharacterSchema> {}
function createCharacterError(err: unknown): SaveCharacterError {
	return SaveCharacterError.from(err);
}

export function saveCharacter(characterId: CharacterId, userId: UserId, data: NewCharacterSchema) {
	return Effect.gen(function* () {
		if (!characterId) yield* new SaveCharacterError("No character ID provided", { status: 400 });

		const Database = yield* DBService;
		const db = yield* Database.db;

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
			catch: createCharacterError
		}).pipe(
			Effect.map((characters) => characters[0]),
			Effect.flatMap((character) =>
				character ? Effect.succeed(character) : Effect.fail(new SaveCharacterError("Failed to save character"))
			)
		);
	});
}

export function deleteCharacter(characterId: CharacterId, userId: UserId) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

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
			catch: createCharacterError
		}).pipe(
			Effect.flatMap((result) =>
				result ? Effect.succeed(result) : Effect.fail(new SaveCharacterError("Character not found", { status: 404 }))
			)
		);
	});
}

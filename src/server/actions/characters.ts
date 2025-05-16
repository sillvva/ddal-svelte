import { type CharacterId, type NewCharacterSchema, type UserId } from "$lib/schemas";
import { SaveError, type SaveResult } from "$lib/util";
import { buildConflictUpdateColumns, db, q } from "$server/db";
import { characters, logs, type Character } from "$server/db/schema";
import { and, eq } from "drizzle-orm";

class CharacterError extends SaveError<NewCharacterSchema> {}

export type SaveCharacterResult = ReturnType<typeof saveCharacter>;
export async function saveCharacter(
	characterId: CharacterId,
	userId: UserId,
	data: NewCharacterSchema
): SaveResult<Character, CharacterError> {
	try {
		if (!characterId) throw new CharacterError("No character ID provided", { status: 400 });

		const [result] = await db
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
			.returning();

		if (!result) throw new CharacterError("Failed to save character");

		return result;
	} catch (err) {
		return CharacterError.from(err);
	}
}

export type DeleteCharacterResult = ReturnType<typeof deleteCharacter>;
export async function deleteCharacter(characterId: CharacterId, userId: UserId): SaveResult<{ id: CharacterId }, CharacterError> {
	try {
		const character = await q.characters.findFirst({
			with: { logs: true },
			where: {
				id: {
					eq: characterId
				}
			}
		});

		if (!character) throw new CharacterError("Character not found", { status: 404 });
		if (character.userId !== userId) throw new CharacterError("Not authorized", { status: 401 });

		const [result] = await db.transaction(async (tx) => {
			await tx
				.update(logs)
				.set({ characterId: null, appliedDate: null })
				.where(and(eq(logs.characterId, characterId), eq(logs.isDmLog, true)));
			return await tx.delete(characters).where(eq(characters.id, characterId)).returning({ id: characters.id });
		});

		if (!result) throw new CharacterError("Failed to delete character");

		return result;
	} catch (err) {
		return CharacterError.from(err);
	}
}

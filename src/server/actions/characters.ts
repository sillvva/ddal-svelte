import { type CharacterId, type NewCharacterSchema, type UserId } from "$lib/schemas";
import { SaveError, type SaveResult } from "$lib/util";
import { rateLimiter, revalidateKeys } from "$server/cache";
import { db, q } from "$server/db";
import { characters, logs, type Character } from "$server/db/schema";
import { and, eq } from "drizzle-orm";

export type SaveCharacterResult = ReturnType<typeof saveCharacter>;
export async function saveCharacter(
	characterId: CharacterId,
	userId: UserId,
	data: NewCharacterSchema
): SaveResult<Character, NewCharacterSchema> {
	try {
		if (!characterId) throw new SaveError("No character ID provided", { status: 400 });

		const { success } = await rateLimiter(characterId === "new" ? "insert" : "update", userId);
		if (!success) throw new SaveError("Too many requests", { status: 429 });

		const [result] =
			characterId === "new"
				? await db
						.insert(characters)
						.values({
							...data,
							userId
						})
						.returning()
				: await db
						.update(characters)
						.set(data)
						.where(and(eq(characters.id, characterId), eq(characters.userId, userId)))
						.returning();

		if (!result) throw new SaveError("Failed to save character");

		await revalidateKeys([
			characterId != "new" && ["character", characterId, "logs"],
			characterId != "new" && ["character", characterId, "no-logs"],
			characterId != "new" && ["dms", userId],
			characterId == "new" && ["characters", userId],
			["search-data", userId]
		]);

		return result;
	} catch (err) {
		return SaveError.from(err);
	}
}

export type DeleteCharacterResult = ReturnType<typeof deleteCharacter>;
export async function deleteCharacter(
	characterId: CharacterId,
	userId: UserId
): SaveResult<{ id: CharacterId }, NewCharacterSchema> {
	try {
		const { success } = await rateLimiter("insert", userId);
		if (!success) throw new SaveError("Too many requests", { status: 429 });

		const character = await q.characters.findFirst({
			with: { logs: true },
			where: (character, { eq }) => eq(character.id, characterId)
		});

		if (!character) throw new SaveError("Character not found", { status: 404 });
		if (character.userId !== userId) throw new SaveError("Not authorized", { status: 401 });

		const [result] = await db.transaction(async (tx) => {
			await tx
				.update(logs)
				.set({ characterId: null, appliedDate: null })
				.where(and(eq(logs.characterId, characterId), eq(logs.isDmLog, true)));
			return await tx.delete(characters).where(eq(characters.id, characterId)).returning({ id: characters.id });
		});

		if (!result) throw new SaveError("Failed to delete character");

		await revalidateKeys([
			["character", result.id, "logs"],
			["character", result.id, "no-logs"],
			["characters", userId],
			["dms", userId],
			["dm-logs", userId],
			["search-data", userId]
		]);

		return result;
	} catch (err) {
		return SaveError.from(err);
	}
}

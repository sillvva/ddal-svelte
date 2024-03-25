import { type NewCharacterSchema } from "$lib/schemas";
import { SaveError, handleSKitError, type SaveResult } from "$lib/util";
import { rateLimiter, revalidateKeys } from "$server/cache";
import { getCharacterCache } from "$server/data/characters";
import { db, q } from "$server/db";
import { characters, logs, type Character } from "$server/db/schema";
import { error } from "@sveltejs/kit";
import { and, eq, inArray } from "drizzle-orm";

export type SaveCharacterResult = ReturnType<typeof saveCharacter>;
export async function saveCharacter(
	characterId: string,
	userId: string,
	data: NewCharacterSchema
): SaveResult<{ id: string; character: Character }, NewCharacterSchema> {
	try {
		if (!characterId) throw new SaveError("No character ID provided", { status: 400 });
		if (!userId) throw new SaveError("Not authenticated", { status: 401 });

		const { success } = await rateLimiter(characterId === "new" ? "insert" : "update", userId);
		if (!success) throw new SaveError("Too many requests", { status: 429 });

		const [result] = await (async () => {
			if (characterId == "new") {
				return await db
					.insert(characters)
					.values({
						...data,
						userId
					})
					.returning();
			} else {
				const character = await getCharacterCache(characterId, false);
				if (!character) throw new SaveError("Character not found", { status: 404 });
				if (character.userId !== userId) throw new SaveError("Not authorized", { status: 401 });
				return await db.update(characters).set(data).where(eq(characters.id, characterId)).returning();
			}
		})();

		if (!result) throw new SaveError("Failed to save character");

		revalidateKeys([
			["character", result.id, "logs"],
			["character", result.id, "no-logs"],
			["dms", userId],
			characterId == "new" && ["characters", userId],
			["search-data", userId]
		]);

		return { id: result.id, character: result };
	} catch (err) {
		return SaveError.from(err);
	}
}

export type DeleteCharacterResult = ReturnType<typeof deleteCharacter>;
export async function deleteCharacter(characterId: string, userId?: string) {
	try {
		if (!userId) error(401, "Not authenticated");

		const { success } = await rateLimiter("insert", userId);
		if (!success) error(429, "Too many requests");

		const character = await q.characters.findFirst({
			with: { logs: true },
			where: (character, { eq }) => eq(character.id, characterId)
		});

		if (!character) error(404, "Character not found");
		if (character.userId !== userId) error(401, "Not authorized");

		const logIds = character.logs.map((log) => log.id);
		const [result] = await db.transaction(async (tx) => {
			if (logIds.length) {
				await tx
					.update(logs)
					.set({ characterId: "" })
					.where(and(inArray(logs.id, logIds), eq(logs.isDmLog, true)));
			}
			return await tx.delete(characters).where(eq(characters.id, characterId)).returning({ id: characters.id });
		});

		if (!result) error(500, "Failed to delete character");

		revalidateKeys([
			["character", result.id, "logs"],
			["character", result.id, "no-logs"],
			["characters", userId],
			["dms", userId],
			["dm-logs", userId],
			["search-data", userId]
		]);

		return { id: result.id, error: null };
	} catch (err) {
		handleSKitError(err);
		if (err instanceof Error) return { id: null, dm: null, error: err.message };
		return { id: null, dm: null, error: "An unknown error has occurred." };
	}
}

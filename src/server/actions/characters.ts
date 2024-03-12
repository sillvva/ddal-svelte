import { SaveError, type NewCharacterSchema, type SaveResult } from "$lib/schemas";
import { handleSKitError, handleSaveError } from "$lib/util";
import { characters, logs, type SelectCharacter } from "$src/db/schema";
import { error } from "@sveltejs/kit";
import { and, eq, inArray } from "drizzle-orm";
import { rateLimiter, revalidateKeys } from "../cache";
import { getCharacterCache } from "../data/characters";
import { db, q } from "../db";

export type SaveCharacterResult = ReturnType<typeof saveCharacter>;
export async function saveCharacter(
	characterId: string,
	userId: string,
	data: NewCharacterSchema
): SaveResult<{ id: string; character: SelectCharacter }, NewCharacterSchema> {
	try {
		if (!characterId) throw new SaveError(400, "No character ID provided");
		if (!userId) throw new SaveError(401, "Not authenticated");

		const { success } = await rateLimiter(characterId === "new" ? "insert" : "update", "save-character", userId);
		if (!success) throw new SaveError(429, "Too many requests");

		const result = await (async () => {
			if (characterId == "new") {
				return await db
					.insert(characters)
					.values({
						...data,
						userId
					})
					.returning()
					.then((r) => r[0]);
			} else {
				const character = await getCharacterCache(characterId, false);
				if (!character) throw new SaveError(404, "Character not found");
				if (character.userId !== userId) throw new SaveError(401, "Not authorized");
				return await db
					.update(characters)
					.set(data)
					.where(eq(characters.id, characterId))
					.returning()
					.then((r) => r[0]);
			}
		})();

		revalidateKeys([
			["character", result.id, "logs"],
			["character", result.id, "no-logs"],
			["dms", userId],
			characterId == "new" && ["characters", userId],
			["search-data", userId]
		]);

		return { id: result.id, character: result };
	} catch (err) {
		return handleSaveError(err);
	}
}

export type DeleteCharacterResult = ReturnType<typeof deleteCharacter>;
export async function deleteCharacter(characterId: string, userId?: string) {
	try {
		if (!userId) error(401, "Not authenticated");

		const { success } = await rateLimiter("insert", "delete-character", userId);
		if (!success) error(429, "Too many requests");

		const character = await q.characters.findFirst({
			with: { logs: true },
			where: (character, { eq }) => eq(character.id, characterId)
		});

		if (!character) error(404, "Character not found");
		if (character.userId !== userId) error(401, "Not authorized");

		const logIds = character.logs.map((log) => log.id);
		const result = await db.transaction(async (tx) => {
			if (logIds.length) {
				await tx
					.update(logs)
					.set({ characterId: "" })
					.where(and(inArray(logs.id, logIds), eq(logs.is_dm_log, true)));
			}
			return await tx
				.delete(characters)
				.where(eq(characters.id, characterId))
				.returning({ id: characters.id })
				.then((r) => r[0]);
		});

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

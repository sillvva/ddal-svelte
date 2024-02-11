import { SaveError, type NewCharacterSchema, type SaveResult } from "$lib/schemas";
import { handleSKitError } from "$lib/util";
import type { Character } from "@prisma/client";
import { error } from "@sveltejs/kit";
import { revalidateKeys } from "../cache";
import { getCharacterCache } from "../data/characters";
import { prisma } from "../db";

export type SaveCharacterResult = ReturnType<typeof saveCharacter>;
export async function saveCharacter(
	characterId: string,
	userId: string,
	data: NewCharacterSchema
): SaveResult<{ id: string; character: Character }> {
	try {
		if (!characterId) throw new SaveError(400, "No character ID provided");
		if (!userId) throw new SaveError(401, "Not authenticated");
		let result: Character;
		if (characterId == "new") {
			result = await prisma.character.create({
				data: {
					...data,
					userId: userId
				}
			});
		} else {
			const character = await getCharacterCache(characterId, false);
			if (!character) throw new SaveError(404, "Character not found");
			if (character.userId !== userId) throw new SaveError(401, "Not authorized");
			result = await prisma.character.update({
				where: { id: characterId },
				data: {
					...data
				}
			});
		}

		revalidateKeys([
			["character", result.id, "logs"],
			["character", result.id, "no-logs"],
			["dms", userId],
			characterId == "new" && ["characters", userId]
		]);

		return { id: result.id, character: result };
	} catch (err) {
		if (err instanceof SaveError) return err;
		if (err instanceof Error) return { status: 500, error: err.message };
		throw new SaveError(500, "An unknown error has occurred.");
	}
}

export type DeleteCharacterResult = ReturnType<typeof deleteCharacter>;
export async function deleteCharacter(characterId: string, userId?: string) {
	try {
		if (!userId) error(401, "Not authenticated");
		const character = await prisma.character.findUnique({
			where: { id: characterId },
			include: { logs: { include: { character: true } } }
		});
		if (!character) error(404, "Character not found");
		if (character.userId !== userId) error(401, "Not authorized");
		const logIds = character.logs.map((log) => log.id);
		const result = await prisma.$transaction(async (tx) => {
			await tx.magicItem.deleteMany({
				where: {
					logGainedId: {
						in: logIds
					}
				}
			});
			await tx.storyAward.deleteMany({
				where: {
					logGainedId: {
						in: logIds
					}
				}
			});
			await tx.log.deleteMany({
				where: {
					id: {
						in: logIds
					}
				}
			});
			return await tx.character.delete({
				where: { id: characterId }
			});
		});

		revalidateKeys([
			["character", result.id, "logs"],
			["character", result.id, "no-logs"],
			["characters", userId],
			["dms", userId]
		]);

		return { id: result.id, error: null };
	} catch (err) {
		handleSKitError(err);
		if (err instanceof Error) return { id: null, dm: null, error: err.message };
		return { id: null, dm: null, error: "An unknown error has occurred." };
	}
}

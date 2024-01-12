import type { NewCharacterSchema } from "$src/lib/types/schemas";
import { handleSKitError } from "$src/lib/types/util";
import type { Character } from "@prisma/client";
import { error } from "@sveltejs/kit";
import { revalidateKeys } from "../cache";
import { getCharacterCache } from "../data/characters";
import { prisma } from "../db";

export type SaveCharacterResult = ReturnType<typeof saveCharacter>;
export async function saveCharacter(characterId: string, userId: string, data: NewCharacterSchema) {
	try {
		if (!characterId) error(400, "No character ID provided");
		if (!userId) error(401, "Not authenticated");
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
			if (!character) error(404, "Character not found");
			if (character.userId !== userId) error(401, "Not authorized");
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

		return { id: result.id, character: result, error: null };
	} catch (err) {
		handleSKitError(err);
		if (err instanceof Error) return { id: null, dm: null, error: err.message };
		return { id: null, dm: null, error: "An unknown error has occurred." };
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

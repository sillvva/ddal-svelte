import type { NewCharacterSchema } from "$src/lib/types/schemas";
import { revalidateTags } from "../cache";
import { getCharacterCache } from "../data/characters";
import { prisma } from "../db";

import type { Character } from "@prisma/client";

export type SaveCharacterResult = ReturnType<typeof saveCharacter>;
export async function saveCharacter(characterId: string, userId: string, data: NewCharacterSchema) {
	try {
		if (!characterId) throw new Error("No character ID provided");
		if (!userId) throw new Error("Not authenticated");
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
			if (!character) throw new Error("Character not found");
			if (character.userId !== userId) throw new Error("Not authorized");
			result = await prisma.character.update({
				where: { id: characterId },
				data: {
					...data
				}
			});
		}
		revalidateTags(["character", result.id, "logs"]);
		revalidateTags(["character", result.id, "no-logs"]);
		if (characterId == "new") revalidateTags(["characters", userId]);
		return { id: result.id, character: result, error: null };
	} catch (error) {
		if (error instanceof Error) return { id: null, character: null, error: error.message };
		else return { id: null, character: null, error: "An unknown error has occurred" };
	}
}

export type DeleteCharacterResult = ReturnType<typeof deleteCharacter>;
export async function deleteCharacter(characterId: string, userId?: string) {
	try {
		if (!userId) throw new Error("Not authenticated");
		const character = await prisma.character.findUnique({
			where: { id: characterId },
			include: { logs: { include: { character: true } } }
		});
		if (!character) throw new Error("Character not found");
		if (character.userId !== userId) throw new Error("Not authorized");
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
		revalidateTags(["character", result.id, "logs"]);
		revalidateTags(["character", result.id, "no-logs"]);
		revalidateTags(["characters", userId]);
		return { id: result.id, error: null };
	} catch (error) {
		if (error instanceof Error) return { id: null, error: error.message };
		else return { id: null, error: "An unknown error has occurred" };
	}
}

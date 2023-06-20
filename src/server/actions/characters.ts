import type { newCharacterSchema } from "$src/lib/types/zod-schema";
import type { z } from "zod";
import { getCharacter } from "../data/characters";
import { prisma } from "../db";

import type { Character } from "@prisma/client";

export type SaveCharacterResult = ReturnType<typeof saveCharacter>;
export async function saveCharacter(characterId: string, userId: string, data: z.infer<typeof newCharacterSchema>) {
	try {
		if (!characterId) throw new Error("No character ID provided.");
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
			const character = await getCharacter(characterId);
			if (!character) throw new Error("Character not found.");
			if (character.userId !== userId) throw new Error("Not authorized.");
			result = await prisma.character.update({
				where: { id: characterId },
				data: {
					...data
				}
			});
		}
		return { id: result.id, error: null };
	} catch (error) {
		if (error instanceof Error) return { id: null, error: error.message };
		else return { id: null, error: "An unknown error has occurred." };
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
		return { id: result.id, error: null };
	} catch (error) {
		if (error instanceof Error) return { id: null, error: error.message };
		else return { id: null, error: "An unknown error has occurred" };
	}
}

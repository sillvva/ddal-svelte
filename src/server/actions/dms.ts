import { SaveError, type DungeonMasterSchema, type SaveResult } from "$lib/schemas";
import { prisma } from "$src/server/db";
import type { DungeonMaster } from "@prisma/client";
import { revalidateKeys, type CacheKey } from "../cache";
import { getUserDMsWithLogsCache } from "../data/dms";

export type SaveDMResult = ReturnType<typeof saveDM>;
export async function saveDM(
	dmId: string,
	userId: string,
	data: DungeonMasterSchema
): SaveResult<{ id: string; dm: DungeonMaster }> {
	try {
		const dm = (await getUserDMsWithLogsCache(userId)).find((dm) => dm.id === dmId);
		if (!dm) throw new SaveError(401, "You do not have permission to edit this DM");

		const result = await prisma.dungeonMaster.update({
			where: { id: dmId },
			data: {
				...data
			}
		});

		const characterIds = [...new Set(dm.logs.filter((l) => l.characterId).map((l) => l.characterId))];
		revalidateKeys([["dms", userId, "logs"], ...characterIds.map((id) => ["character", id as string, "logs"] as CacheKey)]);

		return { id: result.id, dm: result };
	} catch (err) {
		if (err instanceof SaveError) return err;
		if (err instanceof Error) return { status: 500, error: err.message };
		return { status: 500, error: "An unknown error has occurred." };
	}
}

export type DeleteDMResult = ReturnType<typeof deleteDM>;
export async function deleteDM(dmId: string, userId?: string): SaveResult<{ id: string }> {
	try {
		if (!userId) throw new SaveError(401, "You must be logged in to delete a DM");

		const dms = (await getUserDMsWithLogsCache(userId)).filter((dm) => dm.id === dmId);
		if (!dms.length) throw new SaveError(401, "You do not have permission to delete this DM");

		const dm = dms.find((dm) => dm.logs.length);
		if (dm) throw new SaveError(401, "You cannot delete a DM that has logs");

		const result = await prisma.dungeonMaster.delete({
			where: { id: dmId }
		});

		revalidateKeys([["dms", userId, "logs"]]);

		return { id: result.id };
	} catch (err) {
		if (err instanceof SaveError) return err;
		if (err instanceof Error) return { status: 500, error: err.message };
		return { status: 500, error: "An unknown error has occurred." };
	}
}

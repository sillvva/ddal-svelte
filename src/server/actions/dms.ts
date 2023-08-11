import { prisma } from "$src/server/db";
import { revalidateTags } from "../cache";
import { getUserDMsWithLogsCache } from "../data/dms";

import type { DungeonMasterSchema } from "$src/lib/types/schemas";
export type SaveDMResult = ReturnType<typeof saveDM>;
export async function saveDM(dmId: string, userId: string, data: DungeonMasterSchema) {
	try {
		const dm = (await getUserDMsWithLogsCache(userId)).find((dm) => dm.id === dmId);
		if (!dm) throw new Error("You do not have permission to edit this DM");
		const result = await prisma.dungeonMaster.update({
			where: { id: dmId },
			data: {
				...data
			}
		});

		revalidateTags(["dms", userId]);
		for (const { characterId } of dm.logs) {
			if (characterId) revalidateTags(["character", characterId, "logs"]);
		}

		return { id: result.id, dm: result, error: null };
	} catch (error) {
		if (error instanceof Error) return { id: null, dm: null, error: error.message };
		else return { id: null, dm: null, error: "An unknown error has occurred." };
	}
}

export type DeleteDMResult = ReturnType<typeof deleteDM>;
export async function deleteDM(dmId: string, userId?: string) {
	try {
		if (!userId) throw new Error("You must be logged in to delete a DM");
		const dms = (await getUserDMsWithLogsCache(userId)).filter((dm) => dm.id === dmId);
		if (!dms.length) throw new Error("You do not have permission to delete this DM");
		const dm = dms.find((dm) => dm.logs.length);
		if (dm) throw new Error("You cannot delete a DM that has logs");
		const result = await prisma.dungeonMaster.delete({
			where: { id: dmId }
		});
		revalidateTags(["dms", userId]);
		return { id: result.id, error: null };
	} catch (error) {
		if (error instanceof Error) return { id: null, error: error.message };
		else return { id: null, error: "An unknown error has occurred." };
	}
}

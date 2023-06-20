import { prisma } from "$src/server/db";
import { getUserDMs, getUserDMsWithLogs } from "../data/dms";

import type { z } from "zod";
import type { dungeonMasterSchema } from "$src/lib/types/zod-schema";

export type SaveDMResult = ReturnType<typeof saveDM>;
export async function saveDM(dmId: string, userId: string, data: z.infer<typeof dungeonMasterSchema>) {
	try {
		const dms = await getUserDMs(userId);
		if (!dms.find((dm) => dm.id === dmId)) throw new Error("You do not have permission to edit this DM");
		const result = await prisma.dungeonMaster.update({
			where: { id: dmId },
			data: {
				...data
			}
		});
		return { id: result.id, error: null };
	} catch (error) {
		if (error instanceof Error) return { id: null, error: error.message };
		else return { id: null, error: "An unknown error has occurred." };
	}
}

export type DeleteDMResult = ReturnType<typeof deleteDM>;
export async function deleteDM(dmId: string, userId?: string) {
	try {
		if (!userId) throw new Error("You must be logged in to delete a DM");
		const dms = (await getUserDMsWithLogs(userId)).filter((dm) => dm.id === dmId);
		if (!dms.length) throw new Error("You do not have permission to delete this DM");
		const dm = dms.find((dm) => dm.logs.length);
		if (dm) throw new Error("You cannot delete a DM that has logs");
		const result = await prisma.dungeonMaster.delete({
			where: { id: dmId }
		});
		return { id: result.id, error: null };
	} catch (error) {
		if (error instanceof Error) return { id: null, error: error.message };
		else return { id: null, error: "An unknown error has occurred." };
	}
}

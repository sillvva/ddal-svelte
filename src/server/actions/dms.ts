import { type DungeonMasterId, type DungeonMasterSchema } from "$lib/schemas";
import { SaveError, type SaveResult } from "$lib/util";
import { getUserDMsWithLogs } from "$server/data/dms";
import { db } from "$server/db";
import { dungeonMasters, type DungeonMaster } from "$server/db/schema";
import { eq } from "drizzle-orm";

class DMError extends SaveError<DungeonMasterSchema> {}

export type SaveDMResult = ReturnType<typeof saveDM>;
export async function saveDM(
	dmId: DungeonMasterId,
	user: LocalsSession["user"],
	data: DungeonMasterSchema
): SaveResult<DungeonMaster, DMError> {
	try {
		const dm = (await getUserDMsWithLogs(user)).find((dm) => dm.id === dmId);
		if (!dm) throw new DMError("You do not have permission to edit this DM", { status: 401 });

		if (data.name.trim() === "" && data.isUser) data.name = user.name;

		const [result] = await db
			.update(dungeonMasters)
			.set({
				name: data.name,
				DCI: data.DCI || null
			})
			.where(eq(dungeonMasters.id, dmId))
			.returning();

		if (!result) throw new DMError("Failed to save DM");

		return result;
	} catch (err) {
		return DMError.from(err);
	}
}

export type DeleteDMResult = ReturnType<typeof deleteDM>;
export async function deleteDM(dmId: DungeonMasterId, user: LocalsSession["user"]): SaveResult<{ id: DungeonMasterId }, DMError> {
	try {
		const dms = (await getUserDMsWithLogs(user)).filter((dm) => dm.id === dmId);
		if (!dms.length) throw new DMError("You do not have permission to delete this DM", { status: 401 });

		const dm = dms.find((dm) => dm.logs.length);
		if (dm) throw new DMError("You cannot delete a DM that has logs", { status: 400 });

		const [result] = await db.delete(dungeonMasters).where(eq(dungeonMasters.id, dmId)).returning({ id: dungeonMasters.id });
		if (!result) throw new DMError("Failed to delete DM");

		return result;
	} catch (err) {
		return DMError.from(err);
	}
}

import { type DungeonMasterId, type DungeonMasterSchema } from "$lib/schemas";
import { SaveError, type SaveResult } from "$lib/util";
import { getUserDMsWithLogs } from "$server/data/dms";
import { db } from "$server/db";
import { dungeonMasters, type DungeonMaster } from "$server/db/schema";
import { eq } from "drizzle-orm";

export type SaveDMResult = ReturnType<typeof saveDM>;
export async function saveDM(
	dmId: DungeonMasterId,
	user: LocalsSession["user"],
	data: DungeonMasterSchema
): SaveResult<DungeonMaster, DungeonMasterSchema> {
	try {
		const dm = (await getUserDMsWithLogs(user)).find((dm) => dm.id === dmId);
		if (!dm) throw new SaveError("You do not have permission to edit this DM", { status: 401 });

		if (data.name.trim() === "" && data.uid) data.name = user.name;

		const [result] = await db
			.update(dungeonMasters)
			.set({
				...data,
				id: undefined,
				DCI: data.DCI || null,
				uid: data.uid || null
			})
			.where(eq(dungeonMasters.id, dmId))
			.returning();

		if (!result) throw new SaveError("Failed to save DM");

		return result;
	} catch (err) {
		return SaveError.from(err);
	}
}

export type DeleteDMResult = ReturnType<typeof deleteDM>;
export async function deleteDM(
	dmId: DungeonMasterId,
	user: LocalsSession["user"]
): SaveResult<{ id: DungeonMasterId }, DungeonMasterSchema> {
	try {
		const dms = (await getUserDMsWithLogs(user)).filter((dm) => dm.id === dmId);
		if (!dms.length) throw new SaveError("You do not have permission to delete this DM", { status: 401 });

		const dm = dms.find((dm) => dm.logs.length);
		if (dm) throw new SaveError("You cannot delete a DM that has logs", { status: 400 });

		const [result] = await db.delete(dungeonMasters).where(eq(dungeonMasters.id, dmId)).returning({ id: dungeonMasters.id });
		if (!result) throw new SaveError("Failed to delete DM");

		return result;
	} catch (err) {
		return SaveError.from(err);
	}
}

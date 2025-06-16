import { type DungeonMasterId, type DungeonMasterSchema } from "$lib/schemas";
import { SaveError, type SaveResult } from "$lib/util";
import { getUserDMs, type UserDMsWithLogs } from "$server/data/dms";
import { buildConflictUpdateColumns, db } from "$server/db";
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
		const [dm] = await getUserDMs(user, dmId);
		if (!dm) throw new DMError("DM does not exist", { status: 404 });

		if (!data.name.trim()) {
			if (dm.isUser) data.name = user.name;
			else throw new DMError("Name is required", { status: 400, field: "name" });
		}

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

export async function createUserDM(user: LocalsSession["user"]) {
	const [result] = await db
		.insert(dungeonMasters)
		.values({
			name: user.name,
			DCI: null,
			userId: user.id,
			isUser: true
		})
		.onConflictDoUpdate({
			target: [dungeonMasters.userId, dungeonMasters.isUser],
			set: buildConflictUpdateColumns(dungeonMasters, ["name"])
		})
		.returning();

	if (!result) throw new Error("Failed to create DM");

	return result;
}

export type DeleteDMResult = ReturnType<typeof deleteDM>;
export async function deleteDM(dm: UserDMsWithLogs[number]): SaveResult<{ id: DungeonMasterId }, DMError> {
	try {
		if (dm.logs.length) throw new DMError("You cannot delete a DM that has logs", { status: 400 });

		const [result] = await db.delete(dungeonMasters).where(eq(dungeonMasters.id, dm.id)).returning({ id: dungeonMasters.id });
		if (!result) throw new DMError("Failed to delete DM");

		return result;
	} catch (err) {
		return DMError.from(err);
	}
}

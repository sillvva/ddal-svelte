import { type DungeonMasterId, type DungeonMasterSchema } from "$lib/schemas";
import { SaveError, type SaveResult } from "$lib/util";
import { rateLimiter, revalidateKeys, type CacheKey } from "$server/cache";
import { getUserDMsWithLogsCache } from "$server/data/dms";
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
		if (!user) throw new SaveError("You must be logged in to save a DM", { status: 401 });

		const { success } = await rateLimiter("insert", user.id);
		if (!success) throw new SaveError("Too many requests", { status: 429 });

		const dm = (await getUserDMsWithLogsCache(user)).find((dm) => dm.id === dmId);
		if (!dm) throw new SaveError("You do not have permission to edit this DM", { status: 401 });

		if (data.name === "" && data.uid) data.name = user.name || "Me";

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

		const characterIds = [...new Set(dm.logs.filter((l) => l.characterId).map((l) => l.characterId))];
		revalidateKeys([
			["dms", user.id, "logs"],
			...characterIds.map((id) => ["character", id as string, "logs"] as CacheKey),
			["dms", user.id],
			["search-data", user.id]
		]);

		return result;
	} catch (err) {
		return SaveError.from(err);
	}
}

export type DeleteDMResult = ReturnType<typeof deleteDM>;
export async function deleteDM(
	dmId: DungeonMasterId,
	user?: LocalsSession["user"]
): SaveResult<{ id: DungeonMasterId }, DungeonMasterSchema> {
	try {
		if (!user) throw new SaveError("You must be logged in to delete a DM", { status: 401 });

		const { success } = await rateLimiter("insert", user.id);
		if (!success) throw new SaveError("Too many requests", { status: 429 });

		const dms = (await getUserDMsWithLogsCache(user)).filter((dm) => dm.id === dmId);
		if (!dms.length) throw new SaveError("You do not have permission to delete this DM", { status: 401 });

		const dm = dms.find((dm) => dm.logs.length);
		if (dm) throw new SaveError("You cannot delete a DM that has logs", { status: 400 });

		const [result] = await db.delete(dungeonMasters).where(eq(dungeonMasters.id, dmId)).returning({ id: dungeonMasters.id });
		if (!result) throw new SaveError("Failed to delete DM");

		revalidateKeys([
			["dms", user.id, "logs"],
			["search-data", user.id]
		]);

		return result;
	} catch (err) {
		return SaveError.from(err);
	}
}

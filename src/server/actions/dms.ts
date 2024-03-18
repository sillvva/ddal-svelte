import { type DungeonMasterSchema } from "$lib/schemas";
import { SaveError, handleSaveError, type SaveResult } from "$lib/util";
import { rateLimiter, revalidateKeys, type CacheKey } from "$server/cache";
import { getUserDMsWithLogsCache } from "$server/data/dms";
import { db } from "$server/db";
import { dungeonMasters, type DungeonMaster } from "$server/db/schema";
import type { NumericRange } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { FormPathLeaves } from "sveltekit-superforms";

class DmError<T extends DungeonMasterSchema> extends SaveError<T> {
	constructor(
		public status: NumericRange<400, 599>,
		public message: string,
		public field?: FormPathLeaves<T>
	) {
		super(status, message, { field });
	}
}

export type SaveDMResult = ReturnType<typeof saveDM>;
export async function saveDM(
	dmId: string,
	user: LocalsSession["user"],
	data: DungeonMasterSchema
): SaveResult<{ id: string; dm: DungeonMaster }, DungeonMasterSchema> {
	try {
		if (!user) throw new DmError(401, "You must be logged in to save a DM");

		const { success } = await rateLimiter("insert", user.id);
		if (!success) throw new DmError(429, "Too many requests");

		const dm = (await getUserDMsWithLogsCache(user)).find((dm) => dm.id === dmId);
		if (!dm) throw new DmError(401, "You do not have permission to edit this DM");

		if (data.name === "" && data.uid) data.name = user.name || "Me";

		const [result] = await db
			.update(dungeonMasters)
			.set({
				...data,
				DCI: data.DCI || null,
				uid: data.uid || null
			})
			.where(eq(dungeonMasters.id, dmId))
			.returning();

		if (!result) throw new DmError(500, "Failed to save DM");

		const characterIds = [...new Set(dm.logs.filter((l) => l.characterId).map((l) => l.characterId))];
		revalidateKeys([
			["dms", user.id, "logs"],
			...characterIds.map((id) => ["character", id as string, "logs"] as CacheKey),
			["dms", user.id],
			["search-data", user.id]
		]);

		return { id: result.id, dm: result };
	} catch (err) {
		return handleSaveError(err);
	}
}

export type DeleteDMResult = ReturnType<typeof deleteDM>;
export async function deleteDM(dmId: string, user?: LocalsSession["user"]): SaveResult<{ id: string }, DungeonMasterSchema> {
	try {
		if (!user) throw new DmError(401, "You must be logged in to delete a DM");

		const { success } = await rateLimiter("insert", user.id);
		if (!success) throw new DmError(429, "Too many requests");

		const dms = (await getUserDMsWithLogsCache(user)).filter((dm) => dm.id === dmId);
		if (!dms.length) throw new DmError(401, "You do not have permission to delete this DM");

		const dm = dms.find((dm) => dm.logs.length);
		if (dm) throw new DmError(401, "You cannot delete a DM that has logs");

		const [result] = await db.delete(dungeonMasters).where(eq(dungeonMasters.id, dmId)).returning({ id: dungeonMasters.id });
		if (!result) throw new DmError(500, "Failed to delete DM");

		revalidateKeys([
			["dms", user.id, "logs"],
			["search-data", user.id]
		]);

		return result;
	} catch (err) {
		return handleSaveError(err);
	}
}

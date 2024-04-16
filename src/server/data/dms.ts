import type { DungeonMasterId } from "$lib/schemas";
import { cache } from "$server/cache";
import { q } from "$server/db";
import { dungeonMasters } from "$server/db/schema";
import { sorter } from "@sillvva/utils";
import { eq, or } from "drizzle-orm";

export type UserDMsWithLogs = Awaited<ReturnType<typeof getUserDMsWithLogs>>;
export async function getUserDMsWithLogs(user: LocalsSession["user"], id?: DungeonMasterId) {
	if (!user || !user.id) return [];
	const userId = user.id;

	const cond = or(eq(dungeonMasters.owner, userId), eq(dungeonMasters.uid, userId));
	const dms = await q.dungeonMasters.findMany({
		with: {
			logs: {
				with: {
					character: {
						columns: {
							id: true,
							name: true,
							userId: true
						}
					}
				}
			}
		},
		where: (dms, { eq, and }) => (id ? and(cond, eq(dms.id, id)) : cond)
	});

	if (!id && !dms.find((dm) => dm.uid === userId)) {
		dms.push({
			id: "" as DungeonMasterId,
			name: user.name,
			DCI: null,
			uid: userId,
			owner: userId,
			logs: []
		});
	}

	return dms.sort((a, b) => sorter(a.uid, b.uid) || sorter(a.name, b.name));
}

export async function getUserDMsWithLogsCache(user: LocalsSession["user"], id?: DungeonMasterId) {
	if (!user || !user.id) return [];
	return cache(() => getUserDMsWithLogs(user, id), ["dms", id ?? user.id, "logs"], 3 * 3600);
}

export type UserDMs = Awaited<ReturnType<typeof getUserDMs>>;
export async function getUserDMs(user: LocalsSession["user"]) {
	if (!user || !user.id) return [];

	const dms = await q.dungeonMasters.findMany({
		where: (dms, { or, eq }) => or(eq(dms.owner, user.id), eq(dms.uid, user.id))
	});

	if (!dms.find((dm) => dm.uid === user.id)) {
		dms.push({
			id: "" as DungeonMasterId,
			name: user.name,
			DCI: null,
			uid: user.id,
			owner: user.id
		});
	}

	return dms.sort((a, b) => sorter(a.uid, b.uid) || sorter(a.name, b.name));
}

export async function getUserDMsCache(user: LocalsSession["user"]) {
	if (!user || !user.id) return [];
	return cache(() => getUserDMs(user), ["dms", user.id], 3 * 3600);
}

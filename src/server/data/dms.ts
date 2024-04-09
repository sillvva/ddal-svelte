import type { DungeonMasterId } from "$lib/schemas";
import { cache } from "$server/cache";
import { db, q } from "$server/db";
import { characters, logs } from "$server/db/schema";
import { sorter } from "@sillvva/utils";

export type UserDMsWithLogs = Awaited<ReturnType<typeof getUserDMsWithLogs>>;
export async function getUserDMsWithLogs(user: LocalsSession["user"], id?: DungeonMasterId) {
	if (!user || !user.id) return [];

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
		where: (dms, { or, eq, and, exists }) =>
			and(
				id
					? and(or(eq(dms.owner, user.id), eq(dms.uid, user.id)), eq(dms.id, id))
					: or(eq(dms.owner, user.id), eq(dms.uid, user.id)),
				exists(
					db
						.select({ id: logs.id })
						.from(logs)
						.innerJoin(characters, eq(logs.characterId, characters.id))
						.where(and(eq(logs.dungeonMasterId, dms.id)))
				)
			)
	});

	if (!id && !dms.find((dm) => dm.uid === user.id)) {
		dms.push({
			id: "" as DungeonMasterId,
			name: user.name || "Me",
			DCI: null,
			uid: user.id,
			owner: user.id,
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
			name: user.name || "Me",
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

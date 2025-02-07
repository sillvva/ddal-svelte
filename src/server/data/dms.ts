import type { DungeonMasterId } from "$lib/schemas";
import { q } from "$server/db";
import { sorter } from "@sillvva/utils";

export type UserDMsWithLogs = Awaited<ReturnType<typeof getUserDMsWithLogs>>;
export async function getUserDMsWithLogs(user: LocalsSession["user"], id?: DungeonMasterId) {
	if (!user || !user.id) return [];
	const userId = user.id;

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
		where: (dms, { eq, and, or, ne }) => and(or(eq(dms.owner, userId), eq(dms.uid, userId)), id ? eq(dms.id, id) : undefined)
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

	return dms.toSorted((a, b) => sorter(a.uid, b.uid) || sorter(a.name, b.name));
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

	return dms.toSorted((a, b) => sorter(a.uid, b.uid) || sorter(a.name, b.name));
}

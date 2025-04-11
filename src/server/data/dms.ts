import type { DungeonMasterId, UserId } from "$lib/schemas";
import { q, type Filter } from "$server/db";
import { sorter } from "@sillvva/utils";

const userDMFilter = (userId: UserId) => {
	return {
		OR: [
			{
				owner: {
					eq: userId
				}
			},
			{
				uid: {
					eq: userId
				}
			}
		]
	} as const satisfies Filter<"dungeonMasters">;
};

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
		where: {
			id: id
				? {
						eq: id
					}
				: undefined,
			...userDMFilter(userId)
		}
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
		where: userDMFilter(user.id)
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

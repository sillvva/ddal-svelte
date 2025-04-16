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
		where: {
			id: id
				? {
						eq: id
					}
				: undefined,
			userId: {
				eq: userId
			}
		}
	});

	if (!id && !dms.find((dm) => dm.isUser)) {
		dms.push({
			id: "" as DungeonMasterId,
			name: user.name,
			DCI: null,
			userId,
			isUser: true,
			logs: []
		});
	}

	return dms.toSorted((a, b) => sorter(a.isUser, b.isUser) || sorter(a.name, b.name));
}

export type UserDMs = Awaited<ReturnType<typeof getUserDMs>>;
export async function getUserDMs(user: LocalsSession["user"]) {
	if (!user || !user.id) return [];

	const dms = await q.dungeonMasters.findMany({
		where: {
			userId: {
				eq: user.id
			}
		}
	});

	if (!dms.find((dm) => dm.isUser)) {
		dms.push({
			id: "" as DungeonMasterId,
			name: user.name,
			DCI: null,
			userId: user.id,
			isUser: true
		});
	}

	return dms.toSorted((a, b) => sorter(a.isUser, b.isUser) || sorter(a.name, b.name));
}

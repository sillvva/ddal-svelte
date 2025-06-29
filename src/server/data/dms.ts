import type { DungeonMasterId } from "$lib/schemas";
import { createUserDM } from "$server/actions/dms";
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
		const result = await createUserDM(user);
		dms.unshift({
			...result,
			logs: []
		});
	}

	return dms.toSorted((a, b) => sorter(a.isUser, b.isUser) || sorter(a.name, b.name));
}

export type UserDMs = Awaited<ReturnType<typeof getUserDMs>>;
export async function getUserDMs(user: LocalsSession["user"], id?: DungeonMasterId) {
	if (!user || !user.id) return [];

	const dms = await q.dungeonMasters.findMany({
		where: {
			id: id
				? {
						eq: id
					}
				: undefined,
			userId: {
				eq: user.id
			}
		}
	});

	if (!id && !dms.find((dm) => dm.isUser)) {
		const result = await createUserDM(user);
		dms.unshift(result);
	}

	return dms.toSorted((a, b) => sorter(a.isUser, b.isUser) || sorter(a.name, b.name));
}

import { cache } from "$server/cache";
import { q } from "$server/db";

export type UserDMsWithLogs = Awaited<ReturnType<typeof getUserDMsWithLogs>>;
export async function getUserDMsWithLogs(user: LocalsSession["user"]) {
	if (!user || !user.id) return [];

	const dms = await q.dungeonMasters
		.findMany({
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
			where: (dms, { or, eq }) => or(eq(dms.owner, user.id), eq(dms.uid, user.id))
		})
		.then((dms) =>
			dms.map((dm) => ({
				...dm,
				logs: dm.logs.filter((log) => !!log.character?.id)
			}))
		);

	if (!dms.find((dm) => dm.uid === user.id)) {
		dms.push({
			id: "",
			name: user.name || "Me",
			DCI: null,
			uid: user.id,
			owner: user.id,
			logs: []
		});
	}

	return dms
		.map((dm) => ({
			...dm,
			uid: dm.uid || null,
			owner: user.id
		}))
		.sort((a, b) => (b.uid || "").localeCompare(a.uid || "") || a.name.localeCompare(b.name));
}

export async function getUserDMsWithLogsCache(user: LocalsSession["user"]) {
	if (!user || !user.id) return [];
	return cache(() => getUserDMsWithLogs(user), ["dms", user.id, "logs"], 3 * 3600);
}

export type UserDMs = Awaited<ReturnType<typeof getUserDMs>>;
export async function getUserDMs(user: LocalsSession["user"]) {
	if (!user || !user.id) return [];

	const dms = await q.dungeonMasters.findMany({
		where: (dms, { or, eq }) => or(eq(dms.owner, user.id), eq(dms.uid, user.id))
	});

	if (!dms.find((dm) => dm.uid === user.id)) {
		dms.push({
			id: "",
			uid: user.id,
			name: user.name || "Me",
			DCI: null,
			owner: user.id
		});
	}

	return dms
		.map((dm) => ({
			...dm,
			uid: dm.uid || null,
			owner: user.id
		}))
		.sort((a, b) => (b.uid || "").localeCompare(a.uid || "") || a.name.localeCompare(b.name));
}

export async function getUserDMsCache(user: LocalsSession["user"]) {
	if (!user || !user.id) return [];
	return cache(() => getUserDMs(user), ["dms", user.id], 3 * 3600);
}

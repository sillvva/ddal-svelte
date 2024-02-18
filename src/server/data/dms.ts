import { prisma } from "$src/server/db";
import { cache } from "../cache";

export type UserDMsWithLogs = Awaited<ReturnType<typeof getUserDMsWithLogs>>;
export async function getUserDMsWithLogs(user: LocalsSession["user"]) {
	if (!user || !user.id) return [];

	const dms = await prisma.dungeonMaster.findMany({
		where: {
			OR: [
				{
					logs: {
						every: {
							character: {
								userId: user.id
							}
						}
					}
				},
				{
					owner: user.id
				},
				{
					uid: user.id
				}
			]
		},
		include: {
			logs: {
				include: {
					character: {
						select: {
							id: true,
							name: true,
							userId: true
						}
					}
				}
			}
		}
	});

	if (!dms.find((dm) => dm.uid === user.id)) {
		dms.push({
			id: "",
			uid: user.id,
			name: user.name || "Me",
			DCI: null,
			owner: user.id,
			logs: []
		});
	}

	return dms
		.filter((dm) => dm.owner === user.id || dm.uid === user.id)
		.map((dm) => ({
			...dm,
			uid: dm.uid || null,
			owner: user.id
		}))
		.sort((a, b) => (b.uid || "").localeCompare(a.uid || "") || a.name.localeCompare(b.name));
}

export type UserDMs = Awaited<ReturnType<typeof getUserDMs>>;
export async function getUserDMs(user: LocalsSession["user"]) {
	if (!user || !user.id) return [];

	const dms = await prisma.dungeonMaster.findMany({
		where: {
			OR: [
				{
					logs: {
						every: {
							character: {
								userId: user.id
							}
						}
					}
				},
				{
					owner: user.id
				},
				{
					uid: user.id
				}
			]
		}
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
		.filter((dm) => dm.owner === user.id || dm.uid === user.id)
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

export async function getUserDMsCache(user: LocalsSession["user"]) {
	if (!user || !user.id) return [];
	return cache(() => getUserDMs(user), ["dms", user.id], 3 * 3600);
}

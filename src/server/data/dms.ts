import { sorter } from "$src/lib/util";
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
			],
			logs: {}
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
			owner: user.id
		}));
}

export async function getUserDMsWithLogsCache(user: LocalsSession["user"]) {
	if (!user || !user.id) return [];
	return cache(() => getUserDMsWithLogs(user), ["dms", user.id, "logs"], 3 * 3600).then((dms) =>
		dms.sort((a, b) => sorter(b.uid || "", a.uid || "") || sorter(a.name, b.name))
	);
}

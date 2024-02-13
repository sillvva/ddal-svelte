import { prisma } from "$src/server/db";
import { cache } from "../cache";

export type UserDMsWithLogs = Awaited<ReturnType<typeof getUserDMsWithLogs>>;
export async function getUserDMsWithLogs(userId: string) {
	const dms = await prisma.dungeonMaster.findMany({
		where: {
			OR: [
				{
					logs: {
						every: {
							character: {
								userId: userId
							}
						}
					}
				},
				{
					owner: userId
				},
				{
					uid: userId
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

	return dms
		.filter((dm) => dm.owner === userId || dm.uid === userId)
		.map((dm) => ({
			...dm,
			owner: userId
		}));
}

export async function getUserDMsWithLogsCache(userId: string) {
	// await updateDMOwners();
	return cache(() => getUserDMsWithLogs(userId), ["dms", userId, "logs"], 3 * 3600);
}

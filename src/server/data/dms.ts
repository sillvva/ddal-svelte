import { prisma } from "$src/server/db";
import { cache } from "../cache";

// async function updateDMOwners() {
// 	const dms = await prisma.dungeonMaster.findMany({
// 		include: {
// 			logs: {
// 				include: {
// 					character: {
// 						select: {
// 							id: true,
// 							name: true,
// 							userId: true
// 						}
// 					}
// 				}
// 			}
// 		}
// 	});

// 	const users = await prisma.user.findMany();

// 	const updated = dms
// 		.map((dm) => {
// 			const char = dm.logs?.find((log) => log.character?.userId)?.character;
// 			const user = users.find((user) => user.name === dm.name);
// 			const userId = dm.uid || char?.userId || user?.id;
// 			if (!userId) return null;
// 			return {
// 				id: dm.id,
// 				name: dm.name,
// 				DCI: dm.DCI,
// 				uid: dm.uid,
// 				owner: userId
// 			};
// 		})
// 		.filter(Boolean);

// 	for (const dm of updated) {
// 		if (!dm) continue;
// 		await prisma.dungeonMaster.update({
// 			where: {
// 				id: dm.id
// 			},
// 			data: {
// 				owner: dm.owner
// 			}
// 		});
// 	}

// 	console.log(`Updated ${updated.length} DMs`);
// }

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

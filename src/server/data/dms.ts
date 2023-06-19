import { prisma } from "$server/db";

export type UserDMs = Awaited<ReturnType<typeof getUserDMs>>;
export async function getUserDMs(userId: string) {
	return await prisma.dungeonMaster.findMany({
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
					uid: userId
				}
			]
		}
	});
}

export type UserDMsWithLogs = Awaited<ReturnType<typeof getUserDMsWithLogs>>;
export async function getUserDMsWithLogs(userId: string) {
	return await prisma.dungeonMaster.findMany({
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
					uid: userId
				}
			]
		},
		include: {
			logs: {
				include: {
					character: {
						select: {
							id: true,
							name: true
						}
					}
				}
			}
		}
	});
}

export type UserDMWithLogs = Awaited<ReturnType<typeof getUserDMWithLogs>>;
export async function getUserDMWithLogs(userId: string, dmId: string) {
	return await prisma.dungeonMaster.findFirst({
		where: {
			id: dmId,
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
					uid: userId
				}
			]
		},
		include: {
			logs: {
				include: {
					character: {
						select: {
							id: true,
							name: true
						}
					}
				}
			}
		}
	});
}

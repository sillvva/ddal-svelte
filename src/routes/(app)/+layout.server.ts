import { prisma } from "$src/server/db.js";
import type { Account } from "@prisma/client";

export const load = async (event) => {
	const parent = await event.parent();

	let accounts: Account[] = [];
	if (parent.session?.user) {
		accounts = await prisma.account.findMany({
			where: {
				userId: parent.session.user.id
			}
		});
	}

	return {
		accounts
	};
};

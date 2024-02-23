import { prisma } from "$src/server/db.js";
import type { Account } from "@prisma/client";

export const load = async (event) => {
	let accounts: Account[] = [];
	if (event.locals.session?.user) {
		accounts = await prisma.account.findMany({
			where: {
				userId: event.locals.session.user.id
			}
		});
	}

	const userAgent = event.request.headers.get("user-agent");
	const isMac = userAgent?.includes("Mac OS");
	const clearCache = event.cookies.get("clearCache");
	event.cookies.delete("clearCache", { path: "/" });

	return {
		accounts,
		isMac,
		clearCache
	};
};

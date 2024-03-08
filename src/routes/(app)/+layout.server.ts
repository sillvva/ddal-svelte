import { prisma } from "$src/server/db.js";
import type { Account } from "@prisma/client";
import type { Config } from "@sveltejs/adapter-vercel";

export const config: Config = { runtime: "edge" };

export const load = async (event) => {
	const { mobile } = await event.parent();

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

	return {
		accounts,
		isMac,
		mobile
	};
};

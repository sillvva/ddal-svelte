import { q } from "$server/db/index.js";
import type { Account } from "$server/db/schema";

export const load = async (event) => {
	const { mobile } = await event.parent();

	let accounts: Account[] = [];
	if (event.locals.session?.user) {
		const userId = event.locals.session.user.id;
		accounts = await q.accounts.findMany({
			where: (accounts, { eq }) => eq(accounts.userId, userId)
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

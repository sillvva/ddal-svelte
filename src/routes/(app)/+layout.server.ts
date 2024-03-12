import type { SelectAccount } from "$src/db/schema";
import { q } from "$src/server/db.js";

export const load = async (event) => {
	const { mobile } = await event.parent();

	let accounts: SelectAccount[] = [];
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

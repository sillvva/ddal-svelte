import { PROVIDERS } from "$lib/constants.js";
import { authName } from "$lib/util.js";
import { q } from "$server/db/index.js";
import type { Account, AuthClient } from "$server/db/schema";
import { and, inArray } from "drizzle-orm";

export const load = async (event) => {
	const { mobile } = await event.parent();

	let accounts: Account[] = [];
	let authenticators: AuthClient[] = [];
	if (event.locals.session?.user) {
		const userId = event.locals.session.user.id;
		accounts = await q.accounts.findMany({
			where: (accounts, { eq }) =>
				and(
					eq(accounts.userId, userId),
					inArray(
						accounts.provider,
						PROVIDERS.map((p) => p.id)
					)
				)
		});
		authenticators = await q.authenticators
			.findMany({
				where: (authenticators, { eq }) => eq(authenticators.userId, userId),
				columns: {
					credentialID: true,
					name: true
				}
			})
			.then((a) => a.map((a) => ({ ...a, name: authName(a) })));
	}

	const userAgent = event.request.headers.get("user-agent");
	const isMac = userAgent?.includes("Mac OS");

	return {
		accounts,
		authenticators,
		isMac,
		mobile
	};
};

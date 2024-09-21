import { building } from "$app/environment";
import { PROVIDERS } from "$lib/constants.js";
import { privateEnv } from "$lib/env/private.js";
import { appDefaults } from "$lib/stores.js";
import { serverGetCookie } from "$server/cookie.js";
import { q } from "$server/db/index.js";

let checked = false;
if (!checked && building && privateEnv) {
	console.log("\n✅ Environment variables are valid");
	console.table(privateEnv);
	console.log("\n");
	checked = true;
}

export const load = async (event) => {
	const session = event.locals.session;

	const userAgent = event.request.headers.get("user-agent");
	const isMac = userAgent?.includes("Mac OS");
	const mobile = !!userAgent?.match(
		/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/
	);

	const app = serverGetCookie(event.cookies, "app", appDefaults);

	let user: App.PageData["user"] | undefined;
	if (session?.user) {
		const userId = session.user.id;
		user = await q.users.findFirst({
			where: (users, { eq }) => eq(users.id, userId),
			with: {
				accounts: {
					where: (accounts, { inArray }) =>
						inArray(
							accounts.provider,
							PROVIDERS.map((p) => p.id)
						)
				},
				authenticators: true
			}
		});
	}

	return {
		breadcrumbs: [] as Array<{ name: string; href?: string }>,
		session,
		user,
		mobile,
		isMac,
		app
	};
};

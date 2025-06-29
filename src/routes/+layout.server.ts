import { building } from "$app/environment";
import { PROVIDERS } from "$lib/constants.js";
import { privateEnv } from "$lib/env/private.js";
import { appCookieSchema } from "$lib/schemas.js";
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
	const isMac = !!userAgent?.includes("Mac OS");
	const mobile = !!userAgent?.match(
		/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/
	);

	const app = serverGetCookie("app", appCookieSchema);

	let user: App.PageData["user"];
	if (session?.user) {
		user = await q.users.findFirst({
			with: {
				accounts: {
					where: {
						provider: {
							in: PROVIDERS.map((p) => p.id)
						}
					}
				},
				authenticators: true
			},
			where: {
				id: {
					eq: session.user.id
				}
			}
		});
	}

	return {
		breadcrumbs: [] as App.PageData["breadcrumbs"],
		session,
		user,
		mobile,
		isMac,
		app
	};
};

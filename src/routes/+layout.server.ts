import { building } from "$app/environment";
import { privateEnv } from "$lib/env/private.js";
import { appCookieSchema } from "$lib/schemas.js";
import { serverGetCookie } from "$lib/server/cookie.js";

let checked = false;
if (!checked && building && privateEnv) {
	console.log("\n✅ Environment variables are valid");
	console.table(privateEnv);
	console.log("\n");
	checked = true;
}

export const load = async (event) => {
	const user = event.locals.user;
	const session = event.locals.session;

	const userAgent = event.request.headers.get("user-agent");
	const isMac = !!userAgent?.includes("Mac OS");
	const mobile = !!userAgent?.match(
		/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/
	);

	const app = serverGetCookie("app", appCookieSchema);

	return {
		user,
		session,
		mobile,
		isMac,
		app
	};
};

import { building } from "$app/environment";
import { privateEnv } from "$lib/env/private.js";
import { appDefaults } from "$lib/stores.js";
import { serverGetCookie } from "$server/cookie.js";

let checked = false;
if (!checked && building && privateEnv) {
	console.log("\n✅ Environment variables are valid");
	console.table(privateEnv);
	console.log("\n");
	checked = true;
}

export const load = async (event) => {
	const session = event.locals.session;
	const mobile = !!event.request.headers
		.get("user-agent")
		?.match(
			/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/
		);

	const app = serverGetCookie(event.cookies, "app", appDefaults);

	return {
		breadcrumbs: [] as Array<{ name: string; href?: string }>,
		session,
		mobile,
		app
	};
};

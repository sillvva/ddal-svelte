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
	const { user, session, mobile, isMac } = event.locals;
	const app = serverGetCookie("app", appCookieSchema);

	return {
		user,
		session,
		mobile,
		isMac,
		app
	};
};

import { building } from "$app/environment";
import { privateEnv } from "$lib/env/private.js";

let checked = false;
if (!checked && building && privateEnv) {
	console.log("\n✅ Environment variables are valid");
	console.table(privateEnv);
	console.log("\n");
	checked = true;
}

export const load = async (event) => {
	const { user, session, isMac, app } = event.locals;
	return { user, session, isMac, app };
};

import { building } from "$app/environment";
import * as dyn from "$env/static/private";
import * as env from "$env/static/private";
import { privateEnv } from "$lib/env/private.js";
import { serverGetCookie } from "$server/cookie.js";

const filteredObj = (obj: Record<PropertyKey, unknown> | NodeJS.ProcessEnv) => {
	return Object.entries(obj)
  .filter(([key]) => key.startsWith("COOLIFY_"))
  .reduce((obj, [key, val]) => {
    return {
      ...obj,
      [key]: val
    };
  }, {});
};

let checked = false;
if (!checked && building && privateEnv) {
	console.log("\n✅ Environment variables are valid");
	console.table(privateEnv);
	console.log("\n");
	checked = true;

	console.log("\nCoolify check: process.env\n");
	const filteredPE = filteredObj(process.env);
	console.table(Object.keys(filteredPE).length ? filteredPE : { "(none)": "(none)" });
	console.log("\n");

	console.log("\nCoolify check: import.meta.env\n");
	const filteredME = filteredObj(import.meta.env);
	console.table(Object.keys(filteredME).length ? filteredME : { "(none)": "(none)" });
	console.log("\n");

	console.log("\nCoolify check: env\n");
	const filteredE = filteredObj(env);
	console.table(Object.keys(filteredE).length ? filteredE : { "(none)": "(none)" });
	console.log("\n");

	console.log("\nCoolify check: dyn\n");
	const filteredD = filteredObj(dyn);
	console.table(Object.keys(filteredD).length ? filteredD : { "(none)": "(none)" });
	console.log("\n");
}

export const load = async (event) => {
	const session = event.locals.session;
	const mobile = !!event.request.headers
		.get("user-agent")
		?.match(
			/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/
		);

	const app = serverGetCookie<App.Cookie>(event.cookies, "app", {
		settings: {
			theme: "system",
			mode: "dark",
			autoWebAuthn: false,
			authenticators: 0
		},
		characters: {
			magicItems: false,
			display: "list"
		},
		log: {
			descriptions: false
		},
		dmLogs: {
			sort: "asc"
		}
	});

	return {
		breadcrumbs: [] as Array<{ name: string; href?: string }>,
		session,
		mobile,
		app
	};
};

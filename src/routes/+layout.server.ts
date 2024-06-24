import { building } from "$app/environment";
import * as dyn from "$env/static/private";
import * as env from "$env/static/private";
import { privateEnv } from "$lib/env/private.js";
import { serverGetCookie } from "$server/cookie.js";

const filteredObj = (obj: Record<PropertyKey, unknown> | NodeJS.ProcessEnv, name: string, contains = "TEST_") => {
	const filtered = Object.entries(obj)
  .filter(([key]) => key.includes(contains))
  .reduce((obj, [key, val]) => {
    return {
      ...obj,
      [key]: val
    };
  }, {});

	console.log(`\nCoolify check: ${name}\n`);
	console.table(Object.keys(filtered).length ? filtered : { "(none)": "(none)" });
	console.log("\n");
};

let checked = false;
if (!checked && building && privateEnv) {
	console.log("\n✅ Environment variables are valid");
	console.table(privateEnv);
	console.log("\n");
	checked = true;

	filteredObj(process.env, "process.env");
	filteredObj(import.meta.env, "import.meta.env");
	filteredObj(env, "$env/static/private");
	filteredObj(dyn, "$env/dynamic/private");
	console.log(env);
	console.log(dyn);
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

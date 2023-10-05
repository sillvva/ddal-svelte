import { building } from "$app/environment";
import { checkEnv } from "$src/lib/types/env";

if (building) {
	checkEnv().then((env) => {
		if (env) console.log("✅ Environment variables are valid");
	});
}

export const load = async (event) => {
	return {
		session: event.locals.session,
		breadcrumbs: [] as Array<{ name: string; href?: string }>,
		mobile: !!event.request.headers
			.get("user-agent")
			?.match(
				/Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/
			)
	};
};

import { getDMLogs } from "$src/server/data/logs";
import { redirect } from "@sveltejs/kit";

// import type { Actions } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");

	const logs = await getDMLogs(session.user.id, session.user.name || "");

	return {
		logs,
		...event.params
	};
}) satisfies PageServerLoad;

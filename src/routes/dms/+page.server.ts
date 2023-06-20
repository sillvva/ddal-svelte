import { deleteDM } from "$src/server/actions/dms";
import { getUserDMsWithLogs } from "$src/server/data/dms";
import { redirect } from "@sveltejs/kit";

import type { Actions } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");

	const dms = await getUserDMsWithLogs(session.user.id);

	return {
		dms: dms
			.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1))
			.filter((dm) => dm.name != session?.user?.name),
		...event.params
	};
}) satisfies PageServerLoad;

export const actions = {
	deleteDM: async (event) => {
		const session = await event.locals.getSession();
		if (!session?.user) throw redirect(301, "/");
		const data = await event.request.formData();
		const dmId = (data.get("dmId") || "") as string;
		return await deleteDM(dmId, session.user.id);
	}
} satisfies Actions;

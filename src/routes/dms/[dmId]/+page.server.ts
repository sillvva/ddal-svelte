import { deleteDM, saveDM } from "$src/server/actions/dms";
import { getUserDMWithLogs } from "$src/server/data/dms";
import { redirect } from "@sveltejs/kit";

import type { Actions } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");

	const dm = await getUserDMWithLogs(session.user.id, event.params.dmId);
	if (!dm) throw redirect(301, "/dms");

	return {
		dm,
		...event.params
	};
}) satisfies PageServerLoad;

export const actions = {
	saveDM: async (event) => {
		const session = await event.locals.getSession();
		if (!session?.user) throw redirect(301, "/");
		if (!event.params.dmId) throw redirect(301, "/dms");

		const dm = await getUserDMWithLogs(session.user.id, event.params.dmId);
		if (!dm) throw redirect(301, "/dms");

		const data = await event.request.formData();
		const result = await saveDM(event.params.dmId, session.user.id, {
			id: dm.id,
			name: data.get("name") as string,
			DCI: (data.get("DCI") as string) || null,
			uid: dm.uid || ""
		});

		if (result && result.id) throw redirect(301, `/dms`);

		return result;
	},
	deleteDM: async (event) => {
		const session = await event.locals.getSession();
		if (!session?.user) throw redirect(301, "/");

		const data = await event.request.formData();
		const dmId = (data.get("dmId") || "") as string;

		const dm = await getUserDMWithLogs(session.user.id, dmId);
		if (!dm) throw redirect(301, "/dms");

		if (dm.logs.length) return { id: null, error: "You cannot delete a DM that has logs" };

		return await deleteDM(dmId, session.user.id);
	}
} satisfies Actions;

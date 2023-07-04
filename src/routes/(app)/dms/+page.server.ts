import { sorter } from "$lib/utils";
import { deleteDM } from "$src/server/actions/dms";
import { getUserDMsWithLogs } from "$src/server/data/dms";
import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user?.name) throw redirect(301, "/");

	const dms = await getUserDMsWithLogs(session.user.id);

	return {
		title: `${session.user.name}'s DMs`,
		dms: dms.sort((a, b) => sorter(a.name.toLowerCase(), b.name.toLowerCase())).filter((dm) => dm.name != session?.user?.name),
		...event.params
	};
};

export const actions = {
	deleteDM: async (event) => {
		const session = await event.locals.getSession();
		if (!session?.user) throw redirect(301, "/");
		const data = await event.request.formData();
		const dmId = (data.get("dmId") || "") as string;
		return await deleteDM(dmId, session.user.id);
	}
};

import { sorter } from "$lib/util";
import { deleteDM } from "$src/server/actions/dms";
import { signInRedirect } from "$src/server/auth";
import { getUserDMsWithLogsCache } from "$src/server/data/dms";
import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const session = event.locals.session;
	if (!session?.user?.name) signInRedirect(event.url);

	const dms = await getUserDMsWithLogsCache(session.user.id);

	return {
		title: `${session.user.name}'s DMs`,
		dms: dms.sort((a, b) => sorter(a.name.toLowerCase(), b.name.toLowerCase())).filter((dm) => dm.name != session?.user?.name),
		...event.params
	};
};

export const actions = {
	deleteDM: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");
		const data = await event.request.formData();
		const dmId = (data.get("dmId") || "") as string;
		return await deleteDM(dmId, session.user.id);
	}
};

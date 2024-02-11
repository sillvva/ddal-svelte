import { sorter } from "$lib/util";
import { signInRedirect } from "$src/server/auth";
import { getUserDMsWithLogsCache } from "$src/server/data/dms";

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

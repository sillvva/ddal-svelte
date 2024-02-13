import { signInRedirect } from "$src/server/auth";
import { getUserDMsWithLogsCache } from "$src/server/data/dms";

export const load = async (event) => {
	const session = event.locals.session;
	if (!session?.user?.id || !session?.user?.name) signInRedirect(event.url);

	const dms = await getUserDMsWithLogsCache(session.user);

	return {
		title: `${session.user.name}'s DMs`,
		...event.params,
		dms
	};
};

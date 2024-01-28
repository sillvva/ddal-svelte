import { signInRedirect } from "$lib/server/auth";
import { deleteLog } from "$src/server/actions/logs";
import { getDMLogsCache } from "$src/server/data/logs";
import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const session = event.locals.session;
	if (!session?.user?.name) signInRedirect(event.url);

	const logs = await getDMLogsCache(session.user.id, session.user.name);

	return {
		title: `${session.user.name}'s DM Logs`,
		logs,
		...event.params
	};
};

export const actions = {
	deleteLog: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");
		const data = await event.request.formData();
		const logId = (data.get("logId") || "") as string;
		return await deleteLog(logId, session.user.id);
	}
};

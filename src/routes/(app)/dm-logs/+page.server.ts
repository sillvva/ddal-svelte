import { deleteLog } from "$src/server/actions/logs";
import { getDMLogs } from "$src/server/data/logs";
import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();

	const session = parent.session;
	if (!session?.user?.name) throw redirect(301, "/");

	const logs = await getDMLogs(session.user.id, session.user.name);

	return {
		title: `${session.user.name}'s DM Logs`,
		logs,
		...event.params
	};
};

export const actions = {
	deleteLog: async (event) => {
		const session = await event.locals.getSession();
		if (!session?.user) throw redirect(301, "/");
		const data = await event.request.formData();
		const logId = (data.get("logId") || "") as string;
		return await deleteLog(logId, session.user.id);
	}
};

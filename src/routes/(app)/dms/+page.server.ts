import { deleteDM } from "$src/server/actions/dms.js";
import { signInRedirect } from "$src/server/auth";
import { rateLimiter } from "$src/server/cache.js";
import { getUserDMsWithLogsCache } from "$src/server/data/dms";
import { fail, redirect } from "@sveltejs/kit";
import { error } from "console";

export const load = async (event) => {
	const session = event.locals.session;
	if (!session?.user?.id || !session?.user?.name) signInRedirect(event.url);

	const { success } = await rateLimiter("fetch", "dms", session.user.id);
	if (!success) error(429, "Too Many Requests");

	const dms = await getUserDMsWithLogsCache(session.user);

	return {
		title: `${session.user.name}'s DMs`,
		...event.params,
		dms
	};
};

export const actions = {
	deleteDM: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");

		const data = await event.request.formData();
		const dmId = data.get("dmId");
		if (!dmId || typeof dmId !== "string") return fail(400, { error: "DM ID required" });

		const dms = await getUserDMsWithLogsCache(session.user);
		const dm = dms.find((dm) => dm.id == dmId);
		if (!dm) redirect(302, "/dms");

		if (dm.logs.length) return fail(400, { error: "Cannot delete a DM with logs" });

		const result = await deleteDM(dmId, session.user);
		if ("id" in result) redirect(302, `/dms`);

		return fail(result.status, { error: result.error });
	}
};

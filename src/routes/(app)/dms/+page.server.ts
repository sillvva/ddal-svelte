import { deleteDM } from "$server/actions/dms.js";
import { signInRedirect } from "$server/auth";
import { rateLimiter } from "$server/cache.js";
import { getUserDMsWithLogsCache } from "$server/data/dms";
import { error, fail, redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const session = event.locals.session;
	if (!session?.user?.id || !session?.user?.name) signInRedirect(event.url);

	const { success } = await rateLimiter("fetch", session.user.id);
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
		if ("error" in result) return fail(result.status, { error: result.error });

		redirect(302, `/dms`);
	}
};

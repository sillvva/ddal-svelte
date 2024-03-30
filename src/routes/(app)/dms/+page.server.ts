import { dungeonMasterSchema } from "$lib/schemas.js";
import { deleteDM } from "$server/actions/dms.js";
import { signInRedirect } from "$server/auth";
import { rateLimiter } from "$server/cache.js";
import { getUserDMsWithLogsCache } from "$server/data/dms";
import { error, fail, redirect } from "@sveltejs/kit";
import { setError, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { pick } from "valibot";

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

		const form = await superValidate(event, valibot(pick(dungeonMasterSchema, ["id"])));
		if (!form.valid) return fail(400, { form });

		const [dm] = await getUserDMsWithLogsCache(session.user, form.data.id);
		if (!dm) redirect(302, "/dms");

		if (dm.logs.length) {
			setError(form, "id", "Cannot delete a DM with logs");
			return fail(400, { form });
		}

		const result = await deleteDM(dm.id, session.user);
		if ("error" in result) {
			setError(form, "id", result.error);
			return fail(result.status, { form });
		}

		return { form };
	}
};

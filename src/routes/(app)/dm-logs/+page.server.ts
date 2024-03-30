import { logSchema } from "$lib/schemas.js";
import { deleteLog } from "$server/actions/logs";
import { signInRedirect } from "$server/auth";
import { rateLimiter } from "$server/cache.js";
import { getDMLogsCache } from "$server/data/logs";
import { redirect } from "@sveltejs/kit";
import { error } from "console";
import { fail, setError, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { pick } from "valibot";

export const load = async (event) => {
	const session = event.locals.session;
	if (!session?.user?.name) signInRedirect(event.url);

	const { success } = await rateLimiter("fetch", session.user.id);
	if (!success) error(429, "Too Many Requests");

	const logs = await getDMLogsCache(session.user.id);

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

		const form = await superValidate(event, valibot(pick(logSchema, ["id"])));
		if (!form.valid) return fail(400, { form });

		const result = await deleteLog(form.data.id, session.user.id);
		if ("error" in result) {
			setError(form, "id", result.error);
			return fail(result.status, { form });
		}

		return { form };
	}
};

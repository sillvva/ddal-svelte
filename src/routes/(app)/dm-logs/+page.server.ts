import { logSchema } from "$lib/schemas.js";
import { deleteLog } from "$server/actions/logs";
import { assertUser } from "$server/auth.js";
import { getDMLogs } from "$server/data/logs";
import { fail, setError, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { pick } from "valibot";

export const load = async (event) => {
	const session = event.locals.session;
	assertUser(session?.user, event.url);

	const logs = await getDMLogs(session.user.id);

	return {
		title: `${session.user.name}'s DM Logs`,
		logs,
		...event.params
	};
};

export const actions = {
	deleteLog: async (event) => {
		const session = await event.locals.session;
		assertUser(session?.user, event.url);

		const form = await superValidate(event, valibot(pick(logSchema, ["id"])));
		if (!form.valid) return fail(400, { form });

		const result = await deleteLog(form.data.id, session.user.id);
		if ("error" in result) {
			setError(form, "", result.error);
			return fail(result.status, { form });
		}

		return { form };
	}
};

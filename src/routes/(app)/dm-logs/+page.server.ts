import { logSchema } from "$lib/schemas.js";
import { deleteLog } from "$server/actions/logs";
import { assertUser } from "$server/auth.js";
import { getDMLogs } from "$server/data/logs";
import { fetchWithFallback, save } from "$server/db/effect";
import { fail, setError, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { pick } from "valibot";

export const load = async (event) => {
	const session = event.locals.session;
	assertUser(session?.user, event.url);

	const logs = await fetchWithFallback(getDMLogs(session.user.id), () => []);

	return {
		title: `${session.user.name}'s DM Logs`,
		logs,
		...event.params
	};
};

export const actions = {
	deleteLog: async (event) => {
		const session = event.locals.session;
		assertUser(session?.user, event.url);

		const form = await superValidate(event, valibot(pick(logSchema, ["id"])));
		if (!form.valid) return fail(400, { form });

		return await save(deleteLog(form.data.id, session.user.id), {
			onError: (err) => {
				setError(form, "", err.message);
				return fail(err.status, { form });
			},
			onSuccess: () => ({ form })
		});
	}
};

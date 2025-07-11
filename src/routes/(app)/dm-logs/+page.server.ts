import { logSchema } from "$lib/schemas.js";
import { assertUser } from "$server/auth";
import { runOrThrow, save } from "$server/effect";
import { withLog } from "$server/effect/logs.js";
import { fail, setError, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { pick } from "valibot";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user);

	const logs = await runOrThrow(withLog((service) => service.getDMLogs(user.id)));

	return {
		title: `${user.name}'s DM Logs`,
		logs,
		...event.params
	};
};

export const actions = {
	deleteLog: async (event) => {
		const user = event.locals.user;
		assertUser(user);

		const form = await superValidate(event, valibot(pick(logSchema, ["id"])));
		if (!form.valid) return fail(400, { form });

		return await save(
			withLog((service) => service.deleteLog(form.data.id, user.id)),
			{
				onError: (err) => {
					setError(form, "", err.message);
					return fail(err.status, { form });
				},
				onSuccess: () => ({ form })
			}
		);
	}
};

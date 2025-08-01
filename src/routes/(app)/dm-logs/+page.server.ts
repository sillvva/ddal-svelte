import { logIdSchema } from "$lib/schemas.js";
import { assertAuth } from "$server/auth";
import { run, save, validateForm } from "$server/effect";
import { withLog } from "$server/effect/logs.js";
import { fail, setError } from "sveltekit-superforms";
import * as v from "valibot";

export const load = (event) =>
	run(function* () {
		const user = yield* assertAuth();

		const logs = yield* withLog((service) => service.get.dmLogs(user.id));

		return {
			logs,
			...event.params
		};
	});

export const actions = {
	deleteLog: (event) =>
		run(function* () {
			const user = yield* assertAuth();

			const form = yield* validateForm(event, v.object({ id: logIdSchema }));
			if (!form.valid) return fail(400, { form });

			return save(
				withLog((service) => service.set.delete(form.data.id, user.id)),
				{
					onError: (err) => {
						setError(form, "", err.message);
						return fail(err.status, { form });
					},
					onSuccess: () => ({ form })
				}
			);
		})
};

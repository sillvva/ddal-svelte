import { logSchema } from "$lib/schemas.js";
import { assertUser } from "$server/auth";
import { runOrThrow, save, validateForm } from "$server/effect";
import { withLog } from "$server/effect/logs.js";
import { Effect } from "effect";
import { fail, setError } from "sveltekit-superforms";
import { pick } from "valibot";

export const load = (event) =>
	runOrThrow(
		Effect.gen(function* () {
			const user = event.locals.user;
			assertUser(user);

			const logs = yield* withLog((service) => service.getDMLogs(user.id));

			return {
				title: `${user.name}'s DM Logs`,
				logs,
				...event.params
			};
		})
	);

export const actions = {
	deleteLog: (event) =>
		runOrThrow(
			Effect.gen(function* () {
				const user = event.locals.user;
				assertUser(user);

				const form = yield* validateForm(event, pick(logSchema, ["id"]));
				if (!form.valid) return fail(400, { form });

				return save(
					withLog((service) => service.deleteLog(form.data.id, user.id)),
					{
						onError: (err) => {
							setError(form, "", err.message);
							return fail(err.status, { form });
						},
						onSuccess: () => ({ form })
					}
				);
			})
		)
};

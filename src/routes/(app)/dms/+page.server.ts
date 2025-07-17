import { dungeonMasterSchema } from "$lib/schemas.js";
import { assertUser } from "$server/auth";
import { run, save, validateForm } from "$server/effect";
import { withDM } from "$server/effect/dms";
import { fail, redirect } from "@sveltejs/kit";
import { setError } from "sveltekit-superforms";
import { pick } from "valibot";

export const load = (event) =>
	run(function* () {
		const user = event.locals.user;
		assertUser(user);

		const dms = yield* withDM((service) => service.get.userDMs(user, { includeLogs: true }));

		return {
			...event.params,
			dms
		};
	});

export const actions = {
	deleteDM: (event) =>
		run(function* () {
			const user = event.locals.user;
			assertUser(user);

			const form = yield* validateForm(event, pick(dungeonMasterSchema, ["id"]));
			if (!form.valid) return fail(400, { form });

			const [dm] = yield* withDM((service) => service.get.userDMs(user, { id: form.data.id }));
			if (!dm) redirect(302, "/dms");

			return save(
				withDM((service) => service.set.delete(dm, user.id)),
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

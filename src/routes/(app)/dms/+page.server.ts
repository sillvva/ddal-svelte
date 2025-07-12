import { dungeonMasterSchema } from "$lib/schemas.js";
import { assertUser } from "$server/auth";
import { runOrThrow, save, validateForm } from "$server/effect";
import { withDM } from "$server/effect/dms";
import { fail, redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import { setError } from "sveltekit-superforms";
import { pick } from "valibot";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user);

	const dms = await runOrThrow(withDM((service) => service.getUserDMs(user, { includeLogs: true })));

	return {
		title: `${user.name}'s DMs`,
		...event.params,
		dms
	};
};

export const actions = {
	deleteDM: async (event) => {
		const user = event.locals.user;
		assertUser(user);

		return await runOrThrow(
			Effect.gen(function* () {
				const form = yield* validateForm(event, pick(dungeonMasterSchema, ["id"]));
				if (!form.valid) return fail(400, { form });

				const [dm] = yield* withDM((service) => service.getUserDMs(user, { id: form.data.id }));
				if (!dm) redirect(302, "/dms");

				return save(
					withDM((service) => service.deleteDM(dm)),
					{
						onError: (err) => {
							setError(form, "", err.message);
							return fail(err.status, { form });
						},
						onSuccess: () => ({ form })
					}
				);
			})
		);
	}
};

import { dungeonMasterSchema } from "$lib/schemas.js";
import { assertUser } from "$server/auth";
import { runOrThrow, save } from "$server/effect";
import { withFetchDM, withSaveDM } from "$server/effect/dms";
import { fail, redirect } from "@sveltejs/kit";
import { setError, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { pick } from "valibot";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user);

	const dms = await runOrThrow(withFetchDM((service) => service.getUserDMs(user, { includeLogs: true })));

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

		const form = await superValidate(event, valibot(pick(dungeonMasterSchema, ["id"])));
		if (!form.valid) return fail(400, { form });

		const [dm] = await runOrThrow(withFetchDM((service) => service.getUserDMs(user, { id: form.data.id })));
		if (!dm) redirect(302, "/dms");

		return await save(
			withSaveDM((service) => service.deleteDM(dm)),
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

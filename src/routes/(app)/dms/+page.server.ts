import { assertUser, dungeonMasterSchema } from "$lib/schemas.js";
import { deleteDM } from "$server/actions/dms.js";
import { getUserDMs } from "$server/data/dms";
import { fetchWithFallback, save } from "$server/db/effect";
import { fail, redirect } from "@sveltejs/kit";
import { setError, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { pick } from "valibot";

export const load = async (event) => {
	const session = event.locals.session;
	assertUser(session?.user, event.url);

	const dms = await fetchWithFallback(getUserDMs(session.user, { includeLogs: true }), () => []);

	return {
		title: `${session.user.name}'s DMs`,
		...event.params,
		dms
	};
};

export const actions = {
	deleteDM: async (event) => {
		const session = event.locals.session;
		assertUser(session?.user, event.url);

		const form = await superValidate(event, valibot(pick(dungeonMasterSchema, ["id"])));
		if (!form.valid) return fail(400, { form });

		const [dm] = await fetchWithFallback(getUserDMs(session.user, { id: form.data.id }), () => []);
		if (!dm) redirect(302, "/dms");

		return await save(deleteDM(dm), {
			onError: (err) => {
				setError(form, "", err.message);
				return fail(err.status, { form });
			},
			onSuccess: () => ({ form })
		});
	}
};

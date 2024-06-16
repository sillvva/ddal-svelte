import { dungeonMasterSchema } from "$lib/schemas.js";
import { deleteDM } from "$server/actions/dms.js";
import { assertUser } from "$server/auth";
import { getUserDMsWithLogs } from "$server/data/dms";
import { fail, redirect } from "@sveltejs/kit";
import { setError, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { pick } from "valibot";

export const load = async (event) => {
	const session = event.locals.session;
	assertUser(session?.user, event.url);

	const dms = await getUserDMsWithLogs(session.user);

	return {
		title: `${session.user.name}'s DMs`,
		...event.params,
		dms
	};
};

export const actions = {
	deleteDM: async (event) => {
		const session = await event.locals.session;
		assertUser(session?.user, event.url);

		const form = await superValidate(event, valibot(pick(dungeonMasterSchema, ["id"])));
		if (!form.valid) return fail(400, { form });

		const [dm] = await getUserDMsWithLogs(session.user, form.data.id);
		if (!dm) redirect(302, "/dms");

		if (dm.logs.length) {
			setError(form, "", "Cannot delete a DM with logs");
			return fail(400, { form });
		}

		const result = await deleteDM(dm.id, session.user);
		if ("error" in result) {
			setError(form, "", result.error);
			return fail(result.status, { form });
		}

		return { form };
	}
};

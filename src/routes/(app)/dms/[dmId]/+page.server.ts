import { dungeonMasterIdSchema, dungeonMasterSchema } from "$lib/schemas";
import { saveDM } from "$server/actions/dms";
import { signInRedirect } from "$server/auth.js";
import { getUserDMsWithLogsCache } from "$server/data/dms";
import { error, redirect } from "@sveltejs/kit";
import { fail, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { parse } from "valibot";

export const load = async (event) => {
	const parent = await event.parent();

	const session = event.locals.session;
	if (!session?.user?.name) signInRedirect(event.url);

	const dmId = parse(dungeonMasterIdSchema, event.params.dmId);
	const [dm] = await getUserDMsWithLogsCache(session.user, dmId);
	if (!dm) error(404, "DM not found");

	const form = await superValidate(
		{
			id: dm.id,
			name: dm.name,
			DCI: dm.DCI || null,
			uid: dm.uid,
			owner: dm.owner
		},
		valibot(dungeonMasterSchema),
		{
			errors: false
		}
	);

	return {
		...event.params,
		title: `Edit ${dm.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: dm.name,
			href: `/dms/${dm.id}`
		}),
		dm,
		user: session.user,
		form
	};
};

export const actions = {
	saveDM: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");
		if (!event.params.dmId) redirect(302, "/dms");

		const form = await superValidate(event, valibot(dungeonMasterSchema));
		if (!form.valid) return fail(400, { form });

		const dmId = parse(dungeonMasterIdSchema, event.params.dmId);
		const result = await saveDM(dmId, session.user, form.data);
		if ("error" in result) return result.toForm(form);

		redirect(302, `/dms`);
	}
};

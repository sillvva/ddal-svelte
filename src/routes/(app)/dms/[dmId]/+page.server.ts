import { dungeonMasterSchema } from "$lib/schemas";
import { deleteDM, saveDM } from "$server/actions/dms";
import { signInRedirect } from "$server/auth.js";
import { getUserDMsWithLogsCache } from "$server/data/dms";
import { error, fail, redirect } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";

export const load = async (event) => {
	const parent = await event.parent();

	const session = event.locals.session;
	if (!session?.user?.name) signInRedirect(event.url);

	const dms = await getUserDMsWithLogsCache(session.user);
	const dm = dms.find((dm) => dm.id == event.params.dmId);
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
		name: dm.name,
		logs: dm.logs,
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

		const result = await saveDM(event.params.dmId, session.user, form.data);
		if ("error" in result) return result.toForm(form);

		redirect(302, `/dms`);
	},
	deleteDM: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");

		const dms = await getUserDMsWithLogsCache(session.user);
		const dm = dms.find((dm) => dm.id == event.params.dmId);
		if (!dm) redirect(302, "/dms");

		if (dm.logs.length) return fail(400, { error: "Cannot delete a DM with logs" });

		const result = await deleteDM(event.params.dmId, session.user);
		if ("error" in result) return fail(result.status, { error: result.error });

		redirect(302, `/dms`);
	}
};

import { dungeonMasterSchema } from "$lib/schemas";
import { deleteDM, saveDM } from "$src/server/actions/dms";
import { signInRedirect } from "$src/server/auth.js";
import { getUserDMsWithLogsCache } from "$src/server/data/dms";
import { error, fail, redirect } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { object, string } from "valibot";

const deleteDmSchema = object({ id: string() });

export const load = async (event) => {
	const parent = await event.parent();

	const session = event.locals.session;
	if (!session?.user?.name) signInRedirect(event.url);

	const dms = await getUserDMsWithLogsCache(session.user.id);
	const dm = dms.find((dm) => dm.id == event.params.dmId);
	if (!dm) error(404, "DM not found");

	const dmForm = await superValidate(valibot(dungeonMasterSchema), {
		defaults: {
			id: dm.id,
			name: dm.name,
			DCI: dm.DCI || null,
			uid: dm.uid || session.user.id,
			owner: dm.owner
		}
	});

	const deleteForm = await superValidate(valibot(deleteDmSchema), {
		defaults: {
			id: dm.id
		}
	});

	return {
		...event.params,
		title: `Edit ${dm.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: dm.name,
			href: `/dms/${dm.id}`
		}),
		name: dm.name,
		logs: dm.logs,
		dmForm,
		deleteForm
	};
};

export const actions = {
	saveDM: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");
		if (!event.params.dmId) redirect(302, "/dms");

		const form = await superValidate(event, valibot(dungeonMasterSchema));
		if (!form.valid) return fail(400, { form });

		const result = await saveDM(event.params.dmId, session.user.id, form.data);
		if ("id" in result) redirect(302, `/dms`);

		return message(form, result.error, { status: result.status });
	},
	deleteDM: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");

		const form = await superValidate(event, valibot(deleteDmSchema));
		if (!form.valid) return fail(400, { form });

		const dms = await getUserDMsWithLogsCache(session.user.id);
		const dm = dms.find((dm) => dm.id == form.data.id);
		if (!dm) redirect(302, "/dms");

		if (dm.logs.length) return message(form, "This DM has logs and cannot be deleted.", { status: 400 });

		const result = await deleteDM(form.data.id, session.user.id);
		if ("id" in result) redirect(302, `/dms`);

		return message(form, result.error, { status: result.status });
	}
};

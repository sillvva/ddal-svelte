import { parseFormData } from "$lib/components/SchemaForm.svelte";
import { dungeonMasterSchema } from "$lib/schemas";
import { deleteDM, saveDM } from "$src/server/actions/dms";
import { signInRedirect } from "$src/server/auth.js";
import { getUserDMsWithLogsCache } from "$src/server/data/dms";
import { error, redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();

	const session = event.locals.session;
	if (!session?.user?.name) signInRedirect(event.url);

	const dms = await getUserDMsWithLogsCache(session.user.id);
	const dm = dms.find((dm) => dm.id == event.params.dmId);
	if (!dm) error(404, "DM not found");

	return {
		title: `Edit ${dm.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: dm.name,
			href: `/dms/${dm.id}`
		}),
		...event.params,
		dm
	};
};

export const actions = {
	saveDM: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");
		if (!event.params.dmId) redirect(302, "/dms");

		const dms = await getUserDMsWithLogsCache(session.user.id);
		const dm = dms.find((dm) => dm.id == event.params.dmId);
		if (!dm) redirect(302, "/dms");

		try {
			const data = await event.request.formData();
			const parsedData = await parseFormData(data, dungeonMasterSchema);
			const result = await saveDM(event.params.dmId, session.user.id, parsedData);

			if (result && result.id) redirect(302, `/dms`);

			return result;
		} catch (err) {
			if (err instanceof Error) return { id: event.params.dmId, error: err.message };
			throw err;
		}
	},
	deleteDM: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");

		const data = await event.request.formData();
		const dmId = (data.get("dmId") || "") as string;

		const dms = await getUserDMsWithLogsCache(session.user.id);
		const dm = dms.find((dm) => dm.id == event.params.dmId);
		if (!dm) redirect(302, "/dms");

		if (dm.logs.length) return { id: null, error: "You cannot delete a DM that has logs" };

		const result = await deleteDM(dmId, session.user.id);
		if (result && result.id) redirect(302, `/dms`);

		return result;
	}
};

import { dungeonMasterIdSchema, dungeonMasterSchema } from "$lib/schemas";
import { saveDM } from "$server/actions/dms";
import { assertUser } from "$server/auth.js";
import { getUserDMs } from "$server/data/dms";
import { fetchWithFallback, save } from "$server/db/effect";
import { error, redirect } from "@sveltejs/kit";
import { fail, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { safeParse } from "valibot";

export const load = async (event) => {
	const session = event.locals.session;
	assertUser(session?.user, event.url);

	const parent = await event.parent();

	const idResult = safeParse(dungeonMasterIdSchema, event.params.dmId || "");
	if (!idResult.success) redirect(302, `/dms`);
	const dmId = idResult.output;

	const [dm] = await fetchWithFallback(getUserDMs(session.user, { id: dmId }), () => []);
	if (!dm) error(404, "DM not found");

	const form = await superValidate(
		{
			id: dm.id,
			name: dm.name,
			DCI: dm.DCI || null,
			userId: dm.userId,
			isUser: dm.isUser
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
		form,
		user: parent.user
	};
};

export const actions = {
	saveDM: async (event) => {
		const session = event.locals.session;
		assertUser(session?.user, event.url);

		const idResult = safeParse(dungeonMasterIdSchema, event.params.dmId || "");
		if (!idResult.success) redirect(302, `/dms`);
		const dmId = idResult.output;

		const form = await superValidate(event, valibot(dungeonMasterSchema));
		if (!form.valid) return fail(400, { form });

		return await save(saveDM(dmId, session.user, form.data), {
			onError: (err) => err.toForm(form),
			onSuccess: () => "/dms"
		});
	}
};

import { dungeonMasterIdSchema, dungeonMasterSchema } from "$lib/schemas";
import { assertUser } from "$server/auth";
import { runOrThrow, save, validateForm } from "$server/effect";
import { withDM } from "$server/effect/dms";
import { error, redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import { fail, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { safeParse } from "valibot";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user);

	const parent = await event.parent();

	const idResult = safeParse(dungeonMasterIdSchema, event.params.dmId || "");
	if (!idResult.success) redirect(302, `/dms`);
	const dmId = idResult.output;

	return await runOrThrow(
		Effect.gen(function* () {
			const [dm] = yield* withDM((service) => service.getUserDMs(user, { id: dmId }));
			if (!dm) error(404, "DM not found");

			const form = yield* validateForm(
				{
					id: dm.id,
					name: dm.name,
					DCI: dm.DCI || null,
					userId: dm.userId,
					isUser: dm.isUser
				},
				dungeonMasterSchema,
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
		})
	);
};

export const actions = {
	saveDM: async (event) => {
		const user = event.locals.user;
		assertUser(user);

		const idResult = safeParse(dungeonMasterIdSchema, event.params.dmId || "");
		if (!idResult.success) redirect(302, `/dms`);
		const dmId = idResult.output;

		const form = await superValidate(event, valibot(dungeonMasterSchema));
		if (!form.valid) return fail(400, { form });

		return await save(
			withDM((service) => service.saveDM(dmId, user, form.data)),
			{
				onError: (err) => err.toForm(form),
				onSuccess: () => "/dms"
			}
		);
	}
};

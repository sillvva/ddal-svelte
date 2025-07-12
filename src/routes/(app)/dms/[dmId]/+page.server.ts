import { dungeonMasterIdSchema, dungeonMasterSchema } from "$lib/schemas";
import { assertUser } from "$server/auth";
import { runOrThrow, save, validateForm } from "$server/effect";
import { withDM } from "$server/effect/dms";
import { error, redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import { fail } from "sveltekit-superforms";
import { safeParse } from "valibot";

export const load = (event) =>
	runOrThrow(
		Effect.gen(function* () {
			const user = event.locals.user;
			assertUser(user);

			const parent = yield* Effect.promise(() => event.parent());

			const idResult = safeParse(dungeonMasterIdSchema, event.params.dmId || "");
			if (!idResult.success) redirect(302, `/dms`);
			const dmId = idResult.output;

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

export const actions = {
	saveDM: (event) =>
		runOrThrow(
			Effect.gen(function* () {
				const user = event.locals.user;
				assertUser(user);

				const idResult = safeParse(dungeonMasterIdSchema, event.params.dmId || "");
				if (!idResult.success) redirect(302, `/dms`);
				const dmId = idResult.output;

				const form = yield* validateForm(event, dungeonMasterSchema);
				if (!form.valid) return fail(400, { form });

				return save(
					withDM((service) => service.saveDM(dmId, user, form.data)),
					{
						onError: (err) => err.toForm(form),
						onSuccess: () => "/dms"
					}
				);
			})
		)
};

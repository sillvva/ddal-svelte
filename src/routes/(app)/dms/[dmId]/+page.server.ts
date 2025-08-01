import { dungeonMasterIdSchema, dungeonMasterSchema } from "$lib/schemas";
import { assertAuth } from "$server/auth";
import { run, save, validateForm } from "$server/effect";
import { DMNotFoundError, withDM } from "$server/effect/dms";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import { fail } from "sveltekit-superforms";
import * as v from "valibot";

export const load = (event) =>
	run(function* () {
		const user = yield* assertAuth();

		const parent = yield* Effect.promise(event.parent);

		const idResult = v.safeParse(dungeonMasterIdSchema, event.params.dmId || "");
		if (!idResult.success) redirect(307, `/dms`);
		const dmId = idResult.output;

		const [dm] = yield* withDM((service) => service.get.userDMs(user, { id: dmId }));
		if (!dm) return yield* new DMNotFoundError();

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
			dm,
			form,
			user: parent.user
		};
	});

export const actions = {
	saveDM: (event) =>
		run(function* () {
			const user = yield* assertAuth();

			const idResult = v.safeParse(dungeonMasterIdSchema, event.params.dmId || "");
			if (!idResult.success) redirect(302, `/dms`);
			const dmId = idResult.output;

			const form = yield* validateForm(event, dungeonMasterSchema);
			if (!form.valid) return fail(400, { form });

			return save(
				withDM((service) => service.set.save(dmId, user, form.data)),
				{
					onError: (err) => err.toForm(form),
					onSuccess: () => "/dms"
				}
			);
		})
};

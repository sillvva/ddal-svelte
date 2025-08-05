import { dungeonMasterIdSchema, dungeonMasterSchema } from "$lib/schemas";
import { assertAuth } from "$lib/server/auth";
import { runOrThrow, validateForm } from "$lib/server/effect";
import { DMNotFoundError, withDM } from "$lib/server/effect/dms";
import { redirect } from "@sveltejs/kit";
import * as v from "valibot";

export const load = (event) =>
	runOrThrow(function* () {
		const user = yield* assertAuth();

		const idResult = v.safeParse(dungeonMasterIdSchema, event.params.dmId || "");
		if (!idResult.success) redirect(307, `/dms`);
		const dmId = idResult.output;

		const [dm] = yield* withDM((service) => service.get.userDMs(user.id, { id: dmId }));
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
			form
		};
	});

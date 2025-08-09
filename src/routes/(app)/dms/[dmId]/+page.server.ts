import { dungeonMasterIdSchema, dungeonMasterSchema } from "$lib/schemas";
import { validateForm } from "$lib/server/effect";
import { DMNotFoundError, DMService } from "$lib/server/effect/dms";
import { authRedirect } from "$lib/server/effect/runtime.js";
import { redirect } from "@sveltejs/kit";
import * as v from "valibot";

export const load = (event) =>
	authRedirect(function* ({ user }) {
		const DMs = yield* DMService;

		const idResult = v.safeParse(dungeonMasterIdSchema, event.params.dmId || "");
		if (!idResult.success) redirect(307, `/dms`);
		const dmId = idResult.output;

		const [dm] = yield* DMs.get.userDMs(user.id, { id: dmId });
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

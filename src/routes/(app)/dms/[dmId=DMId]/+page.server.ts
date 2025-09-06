import { dungeonMasterSchema } from "$lib/schemas";
import { validateForm } from "$lib/server/effect/forms";
import { run } from "$lib/server/effect/runtime.js";
import { assertAuth } from "$lib/server/effect/services/auth";
import { DMNotFoundError, DMService } from "$lib/server/effect/services/dms";

export const load = (event) =>
	run(function* () {
		const { user } = yield* assertAuth();
		const DMs = yield* DMService;

		const dmId = event.params.dmId;
		const [dm] = yield* DMs.get.userDMs(user, { id: dmId });
		if (!dm) return yield* new DMNotFoundError();

		const form = yield* validateForm(
			{
				id: dm.id,
				name: dm.name,
				DCI: dm.DCI || null,
				userId: dm.userId,
				isUser: dm.isUser
			},
			dungeonMasterSchema
		);

		return {
			...event.params,
			dm,
			form
		};
	});

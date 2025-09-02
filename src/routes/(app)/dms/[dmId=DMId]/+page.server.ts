import { dungeonMasterSchema } from "$lib/schemas";
import { validateForm } from "$lib/server/effect/forms";
import { runAuth } from "$lib/server/effect/runtime.js";
import { DMNotFoundError, DMService } from "$lib/server/effect/services/dms";

export const load = (event) =>
	runAuth(function* (user) {
		const DMs = yield* DMService;

		const dmId = event.params.dmId;
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
			dungeonMasterSchema
		);

		return {
			...event.params,
			dm,
			form
		};
	});

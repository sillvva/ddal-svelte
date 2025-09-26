import { dungeonMasterIdSchema, dungeonMasterSchema } from "$lib/schemas";
import { validateForm } from "$lib/server/effect/forms";
import { guardedQuery } from "$lib/server/effect/remote";
import { assertAuth } from "$lib/server/effect/services/auth";
import { DMNotFoundError, DMService } from "$lib/server/effect/services/dms";

export const getDMs = guardedQuery(function* () {
	const { user } = yield* assertAuth();
	const DMs = yield* DMService;
	return yield* DMs.get.userDMs(user);
});

export const getDMForm = guardedQuery(dungeonMasterIdSchema, function* (input, { user }) {
	const DMs = yield* DMService;

	const [dm] = yield* DMs.get.userDMs(user, { id: input });
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
		dm,
		form
	};
});

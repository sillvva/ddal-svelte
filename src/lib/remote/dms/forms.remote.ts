import { dungeonMasterIdSchema, dungeonMasterSchema, type DungeonMasterSchemaIn } from "$lib/schemas";
import { saveForm, validateForm } from "$lib/server/effect/forms";
import { guardedCommand, guardedQuery } from "$lib/server/effect/remote";
import { DMNotFoundError, DMService } from "$lib/server/effect/services/dms";

export const edit = guardedQuery(dungeonMasterIdSchema, function* (input, { user }) {
	const DMs = yield* DMService;

	const [dm] = yield* DMs.get.all(user, { id: input });
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

export const save = guardedCommand(function* (input: DungeonMasterSchemaIn, { user }) {
	const DMs = yield* DMService;

	const form = yield* validateForm(input, dungeonMasterSchema);
	if (!form.valid) return form;

	return yield* saveForm(DMs.set.save(user, form.data), {
		onSuccess: () => "/dms",
		onError: (err) => {
			err.toForm(form);
			return form;
		}
	});
});

import { dungeonMasterSchema, type DungeonMasterSchemaIn } from "$lib/schemas";
import { saveForm, validateForm } from "$lib/server/effect/forms";
import { guardedCommand } from "$lib/server/effect/remote";
import { DMService } from "$lib/server/effect/services/dms";

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

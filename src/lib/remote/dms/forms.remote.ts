import { command } from "$app/server";
import { dungeonMasterIdSchema, dungeonMasterSchema, type DungeonMasterSchemaIn } from "$lib/schemas";
import { parse, saveForm, validateForm } from "$lib/server/effect/forms";
import { authReturn } from "$lib/server/effect/runtime";
import { DMService } from "$lib/server/effect/services/dms";

export const save = command("unchecked", (input: DungeonMasterSchemaIn) =>
	authReturn(function* (user) {
		const DMs = yield* DMService;

		const dmId = yield* parse(dungeonMasterIdSchema, input.id, "/dms");

		const form = yield* validateForm(input, dungeonMasterSchema);
		if (!form.valid) return form;

		return yield* saveForm(DMs.set.save(dmId, user, form.data), {
			onError: (err) => {
				err.toForm(form);
				return form;
			},
			onSuccess: () => "/dms"
		});
	})
);

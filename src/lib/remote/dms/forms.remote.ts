import { command } from "$app/server";
import { dungeonMasterIdSchema, dungeonMasterSchema, type DungeonMasterSchemaIn } from "$lib/schemas";
import { saveForm, validateForm } from "$lib/server/effect/forms";
import { authReturn } from "$lib/server/effect/runtime";
import { DMService } from "$lib/server/effect/services/dms";
import * as v from "valibot";

export const save = command("unchecked", (input: DungeonMasterSchemaIn) =>
	authReturn(function* (user) {
		const DMs = yield* DMService;

		const idResult = v.safeParse(dungeonMasterIdSchema, input.id);
		if (!idResult.success) return `/dms`;
		const dmId = idResult.output;

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

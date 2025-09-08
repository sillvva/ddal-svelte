import { command } from "$app/server";
import { dungeonMasterIdSchema, dungeonMasterSchema, type DungeonMasterSchemaIn } from "$lib/schemas";
import { redirectOnFail } from "$lib/server/effect/errors";
import { parse, saveForm, validateForm } from "$lib/server/effect/forms";
import { runSafe } from "$lib/server/effect/runtime";
import { assertAuth } from "$lib/server/effect/services/auth";
import { DMService } from "$lib/server/effect/services/dms";

export const save = command("unchecked", (input: DungeonMasterSchemaIn) =>
	runSafe(function* () {
		const { user } = yield* assertAuth();
		const DMs = yield* DMService;

		const dmId = yield* redirectOnFail(parse(dungeonMasterIdSchema, input.id), "/dms", 301);

		const form = yield* validateForm(input, dungeonMasterSchema);
		if (!form.valid) return form;

		return yield* saveForm(DMs.set.save(dmId, user, form.data), {
			onSuccess: () => "/dms",
			onError: (err) => {
				err.toForm(form);
				return form;
			}
		});
	})
);

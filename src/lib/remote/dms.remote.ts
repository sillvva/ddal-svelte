import { command } from "$app/server";
import { placeholderQuery } from "$lib/remote/command.remote";
import { dungeonMasterIdSchema, dungeonMasterSchema, type DungeonMasterSchemaIn } from "$lib/schemas";
import { save, validateForm, type ErrorParams } from "$lib/server/effect";
import { DMService } from "$lib/server/effect/dms";
import { authReturn } from "$lib/server/effect/runtime";
import { Data } from "effect";
import * as v from "valibot";

class DMNotFoundError extends Data.TaggedError("DMNotFoundError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Dungeon Master not found", status: 404, cause: err });
	}
}

class DeleteUserDMError extends Data.TaggedError("DeleteUserDMError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Unable to delete User DM", status: 500, cause: err });
	}
}

export const saveDM = command("unchecked", (input: DungeonMasterSchemaIn) =>
	authReturn(function* (user) {
		const DMs = yield* DMService;

		const idResult = v.safeParse(dungeonMasterIdSchema, input.id);
		if (!idResult.success) return `/dms`;
		const dmId = idResult.output;

		const form = yield* validateForm(input, dungeonMasterSchema);
		if (!form.valid) return form;

		return yield* save(DMs.set.save(dmId, user, form.data), {
			onError: (err) => {
				err.toForm(form);
				return form;
			},
			onSuccess: () => "/dms"
		});
	})
);

export const deleteDM = command(dungeonMasterIdSchema, (id) =>
	authReturn(function* (user) {
		const DMs = yield* DMService;

		const [dm] = yield* DMs.get.userDMs(user.id, { id });
		if (!dm) return yield* new DMNotFoundError();
		if (dm.isUser) return yield* new DeleteUserDMError();

		placeholderQuery().refresh();

		return yield* DMs.set.delete(dm, user.id);
	})
);

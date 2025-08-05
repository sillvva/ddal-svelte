import { command } from "$app/server";
import { dungeonMasterIdSchema, dungeonMasterSchema, type DungeonMasterSchemaIn } from "$lib/schemas";
import { assertAuthOrFail } from "$lib/server/auth";
import { run, runRemote, saveRemote, validateForm, type ErrorParams } from "$lib/server/effect";
import { withDM } from "$lib/server/effect/dms";
import { redirect } from "@sveltejs/kit";
import { Data, Effect } from "effect";
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
	run(function* () {
		const user = yield* assertAuthOrFail();

		const idResult = v.safeParse(dungeonMasterIdSchema, input.id);
		if (!idResult.success) redirect(302, `/dms`);
		const dmId = idResult.output;

		const form = yield* validateForm(input, dungeonMasterSchema);
		if (!form.valid) return form;

		return yield* Effect.promise(() =>
			saveRemote(
				withDM((service) => service.set.save(dmId, user, form.data)),
				{
					onError: (err) => {
						err.toForm(form);
						return form;
					},
					onSuccess: () => "/dms"
				}
			)
		);
	})
);

export const deleteDM = command(dungeonMasterIdSchema, (id) =>
	runRemote(function* () {
		const user = yield* assertAuthOrFail();

		const [dm] = yield* withDM((service) => service.get.userDMs(user.id, { id }));
		if (!dm) return yield* new DMNotFoundError();
		if (dm.isUser) return yield* new DeleteUserDMError();

		return yield* withDM((service) => service.set.delete(dm, user.id));
	})
);

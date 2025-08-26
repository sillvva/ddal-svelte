import { command } from "$app/server";
import { dungeonMasterIdSchema } from "$lib/schemas";
import { type ErrorParams } from "$lib/server/effect/errors";
import { runAuth } from "$lib/server/effect/runtime";
import { DMService } from "$lib/server/effect/services/dms";
import { Data } from "effect";

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

export const deleteDM = command(dungeonMasterIdSchema, (id) =>
	runAuth(
		function* (user) {
			const DMs = yield* DMService;

			const [dm] = yield* DMs.get.userDMs(user.id, { id });
			if (!dm) return yield* new DMNotFoundError();
			if (dm.isUser) return yield* new DeleteUserDMError();

			return yield* DMs.set.delete(dm, user.id);
		},
		{ safe: true }
	)
);

import { dungeonMasterIdSchema } from "#lib/schemas.js";
import { type ErrorParams } from "#lib/server/effect/errors.js";
import { guardedCommand } from "#lib/server/effect/guarded.js";
import { DMService } from "#lib/server/effect/services/dms.js";
import { Data } from "effect";

class DeleteUserDMError extends Data.TaggedError("DeleteUserDMError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Unable to delete User DM", status: 500, cause: err });
	}
}

export const deleteDM = guardedCommand(dungeonMasterIdSchema, function* (id, { user }) {
	const DMs = yield* DMService;

	const dm = yield* DMs.get.one(id, user.id, false);
	if (dm.isUser) return yield* new DeleteUserDMError();

	return yield* DMs.delete(dm, user.id);
});

import { command } from "$app/server";
import { dungeonMasterIdSchema } from "$lib/schemas";
import { assertAuthOrFail } from "$lib/server/auth";
import { runRemote, type ErrorParams } from "$lib/server/effect";
import { withDM } from "$lib/server/effect/dms";
import { Data } from "effect";

export class DMNotFoundError extends Data.TaggedError("DMNotFoundError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Dungeon Master not found", status: 404, cause: err });
	}
}

export class DeleteUserDMError extends Data.TaggedError("DeleteUserDMError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Unable to delete User DM", status: 500, cause: err });
	}
}

export const deleteDM = command(dungeonMasterIdSchema, (id) =>
	runRemote(function* () {
		const user = yield* assertAuthOrFail();

		const [dm] = yield* withDM((service) => service.get.userDMs(user.id, { id }));
		if (!dm) return yield* new DMNotFoundError();
		if (dm.isUser) return yield* new DeleteUserDMError();

		return yield* withDM((service) => service.set.delete(dm, user.id));
	})
);

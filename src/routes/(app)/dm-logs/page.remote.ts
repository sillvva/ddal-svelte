import { command } from "$app/server";
import { logIdSchema } from "$lib/schemas";
import { assertAuthOrFail } from "$lib/server/auth";
import { runRemote } from "$lib/server/effect";
import { withLog } from "$lib/server/effect/logs";

export const deleteLog = command(logIdSchema, (id) =>
	runRemote(function* () {
		const user = yield* assertAuthOrFail();
		return yield* withLog((service) => service.set.delete(id, user.id));
	})
);

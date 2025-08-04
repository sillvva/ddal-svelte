import { command } from "$app/server";
import { characterIdSchema, logIdSchema } from "$lib/schemas";
import { assertAuthOrFail } from "$lib/server/auth";
import { runRemote } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters";
import { withLog } from "$lib/server/effect/logs";

export const deleteCharacter = command(characterIdSchema, (id) =>
	runRemote(function* () {
		const user = yield* assertAuthOrFail();
		return yield* withCharacter((service) => service.set.delete(id, user.id));
	})
);

export const deleteLog = command(logIdSchema, (id) =>
	runRemote(function* () {
		const user = yield* assertAuthOrFail();
		return yield* withLog((service) => service.set.delete(id, user.id));
	})
);

import { characterIdSchema, completeCharacterImageSchema, prepareCharacterImageSchema } from "#lib/schemas.js";
import { guardedCommand } from "#lib/server/effect/guarded.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { CharacterService } from "#lib/server/effect/services/characters.js";
import { StorageService } from "#lib/server/effect/services/storage.js";
import { Effect } from "effect";

export const deleteCharacter = guardedCommand(characterIdSchema, function* (id, { user }) {
	const Characters = yield* CharacterService;
	const Storage = yield* StorageService;
	const keys = yield* Storage.collectCharacterKeys(user.id, id);
	const removed = yield* Characters.delete(id, user.id);
	yield* Storage.releaseCharacter(user.id, id, keys).pipe(
		Effect.catch((error) => AppLog.error("characters.actions.deleteCharacter image cleanup", { message: error.message }))
	);
	return removed;
});

export const prepareCharacterImage = guardedCommand(prepareCharacterImageSchema, function* (input, { user }) {
	const Storage = yield* StorageService;
	return yield* Storage.prepare({ ...input, userId: user.id });
});

export const completeCharacterImage = guardedCommand(completeCharacterImageSchema, function* (input, { user }) {
	const Storage = yield* StorageService;
	return yield* Storage.complete(user.id, input.uploadId);
});

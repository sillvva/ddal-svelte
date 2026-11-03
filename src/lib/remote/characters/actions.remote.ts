import { characterIdSchema, completeCharacterImageSchema, prepareCharacterImageSchema } from "#lib/schemas.js";
import { guardedCommand, refreshAll } from "#lib/server/effect/guarded.js";
import { CharacterService } from "#lib/server/effect/services/characters.js";
import { StorageService } from "#lib/server/effect/services/storage.js";
import * as API from "#lib/remote/index.js";
import { getAll, getAllSelect } from "./queries.remote.js";

export const deleteCharacter = guardedCommand(characterIdSchema, function* (id, { user }) {
	const Characters = yield* CharacterService;
	const Storage = yield* StorageService;
	const removed = yield* Characters.delete(id, user.id);
	yield* Storage.purgePending();
	yield* refreshAll(API.images.queries.storage().refresh(), getAll().refresh(), getAllSelect().refresh());
	return removed;
});

export const prepareCharacterImage = guardedCommand(prepareCharacterImageSchema, function* (input, { user }) {
	const Storage = yield* StorageService;
	return yield* Storage.prepare({ purpose: "character", ...input, userId: user.id });
});

export const completeCharacterImage = guardedCommand(completeCharacterImageSchema, function* (input, { user }) {
	const Storage = yield* StorageService;
	return yield* Storage.complete(user.id, input.uploadId, "character");
});

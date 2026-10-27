import { request } from "#lib/remote/app/queries.remote.js";
import { completeCharacterImageSchema, prepareAvatarImageSchema, saveAvatarSchema } from "#lib/schemas.js";
import { guardedCommand, refreshAll } from "#lib/server/effect/guarded.js";
import { StorageService } from "#lib/server/effect/services/storage.js";

export const prepareAvatarImage = guardedCommand(prepareAvatarImageSchema, function* (input, { user }) {
	const Storage = yield* StorageService;
	return yield* Storage.prepare({ purpose: "avatar", ...input, userId: user.id });
});

export const completeAvatarImage = guardedCommand(completeCharacterImageSchema, function* (input, { user }) {
	const Storage = yield* StorageService;
	return yield* Storage.complete(user.id, input.uploadId, "avatar");
});

export const saveAvatar = guardedCommand(saveAvatarSchema, function* (input, { user }) {
	const Storage = yield* StorageService;
	const saved = yield* Storage.saveAvatar(user.id, input.uploadId);
	yield* refreshAll(request().refresh());
	return saved;
});

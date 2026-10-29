import { request } from "#lib/remote/app/queries.remote.js";
import { completeCharacterImageSchema, prepareAvatarImageSchema, saveAvatarSchema } from "#lib/schemas.js";
import { guardedCommand, refreshAll } from "#lib/server/effect/guarded.js";
import { StorageService } from "#lib/server/effect/services/storage.js";

export const prepareAvatarImage = guardedCommand(
	prepareAvatarImageSchema,
	function* (input, { user }) {
		const Storage = yield* StorageService;
		return yield* Storage.prepare({ purpose: "avatar", ...input, userId: user.id });
	},
	"any"
);

export const completeAvatarImage = guardedCommand(
	completeCharacterImageSchema,
	function* (input, { user }) {
		const Storage = yield* StorageService;
		return yield* Storage.complete(user.id, input.uploadId, "avatar");
	},
	"any"
);

export const saveAvatar = guardedCommand(saveAvatarSchema, function* (input, { user, event }) {
	const Storage = yield* StorageService;
	const saved = yield* Storage.saveAvatar(user.id, input.uploadId);
	// `request()` returns the user hooks loaded at the start of this request.
	// Publishing that copy would leave the header on the previous avatar.
	if (event.locals.user) event.locals.user.image = saved.imageUrl;
	yield* refreshAll(request().refresh());
	return saved;
});

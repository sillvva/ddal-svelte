import { guardedQuery } from "#lib/server/effect/guarded.js";
import { StorageService } from "#lib/server/effect/services/storage.js";

/** Saved character portraits and note images, each against its own account quota. Admins have no caps. */
export const storage = guardedQuery(function* ({ user }) {
	const Storage = yield* StorageService;
	return yield* Storage.imageUsage(user.id);
});

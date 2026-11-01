import * as API from "#lib/remote/index.js";
import { logIdSchema } from "#lib/schemas.js";
import { guardedCommand, refreshAll } from "#lib/server/effect/guarded.js";
import { LogService } from "#lib/server/effect/services/logs.js";
import { StorageService } from "#lib/server/effect/services/storage.js";

export const deleteLog = guardedCommand(logIdSchema, function* (id, { user }) {
	const Logs = yield* LogService;
	const Storage = yield* StorageService;
	const removed = yield* Logs.delete(id, user.id);
	yield* Storage.purgePending();
	yield* refreshAll(
		API.logs.queries.getDmLogs().refresh(),
		API.dms.queries.getAll().refresh(),
		API.dms.queries.get(removed.dungeonMasterId).refresh(),
		API.characters.queries.getAll().refresh(),
		...(removed.characterId
			? [
					API.characters.queries.get({ param: removed.characterId }).refresh(),
					API.characters.queries.get({ param: removed.characterId, newRedirect: true }).refresh()
				]
			: [])
	);
	return removed;
});

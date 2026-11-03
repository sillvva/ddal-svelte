import { logToDraftData } from "#lib/log-draft.js";
import * as API from "#lib/remote/index.js";
import { logDraftIdSchema, logIdSchema } from "#lib/schemas.js";
import { guardedCommand, refreshAll } from "#lib/server/effect/guarded.js";
import { LogDraftService } from "#lib/server/effect/services/log-drafts.js";
import { LogNotFoundError, LogService } from "#lib/server/effect/services/logs.js";

/** Creates a draft from a log the user owns, without its id, character, or date. */
export const copyFromLog = guardedCommand(logIdSchema, function* (logId, { user }) {
	const Logs = yield* LogService;
	const Drafts = yield* LogDraftService;
	const log = yield* Logs.get.one(logId, user.id);
	if (!log) return yield* new LogNotFoundError();

	const saved = yield* Drafts.create(user, logToDraftData(log));
	yield* refreshAll(API.drafts.queries.read(saved.id).refresh());
	return { id: saved.id, data: saved.data, expiresAt: saved.expiresAt };
});

export const remove = guardedCommand(logDraftIdSchema, function* (id, { user }) {
	const Drafts = yield* LogDraftService;
	const removed = yield* Drafts.remove(id, user.id);
	yield* refreshAll(API.drafts.queries.read(id).refresh());
	return removed;
});

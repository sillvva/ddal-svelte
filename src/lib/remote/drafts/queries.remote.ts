import { logDraftIdSchema } from "#lib/schemas.js";
import { guardedQuery } from "#lib/server/effect/guarded.js";
import { LogDraftService } from "#lib/server/effect/services/log-drafts.js";

/** Any signed-in user can read a draft. Expired drafts are reported as missing. */
export const read = guardedQuery(logDraftIdSchema, function* (id, { user }) {
	const Drafts = yield* LogDraftService;
	const row = yield* Drafts.read(id);
	return { id: row.id, owner: row.userId === user.id, data: row.data, expiresAt: row.expiresAt };
});

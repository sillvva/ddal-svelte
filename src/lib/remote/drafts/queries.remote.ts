import { LOG_DRAFT_LIMIT } from "#lib/log-draft.js";
import { logDraftIdSchema } from "#lib/schemas.js";
import { guardedQuery } from "#lib/server/effect/guarded.js";
import { LogDraftService } from "#lib/server/effect/services/log-drafts.js";
import { Effect } from "effect";

/** Any signed-in user can read a draft. Expired drafts are reported as missing. */
export const read = guardedQuery(logDraftIdSchema, function* (id, { user }) {
	const Drafts = yield* LogDraftService;
	const row = yield* Drafts.read(id);
	return { id: row.id, owner: row.userId === user.id, data: row.data, expiresAt: row.expiresAt };
});

export const getAll = guardedQuery(function* ({ user }) {
	const Drafts = yield* LogDraftService;
	const drafts = yield* Drafts.list(user.id).pipe(
		Effect.map((rows) =>
			rows.map((row) => ({
				id: row.id,
				kind: row.data.kind,
				name: row.data.name,
				type: row.data.type,
				updatedAt: row.updatedAt,
				expiresAt: row.expiresAt
			}))
		)
	);
	return { drafts, limit: LOG_DRAFT_LIMIT };
});

import { draftDescriptionHasNewImages, LOG_DRAFT_LIMIT, LOG_DRAFT_TTL_MS, logDraftExpiryCutoff } from "#lib/log-draft.js";
import type { LocalsUser, LogDraftData, LogDraftId, UserId } from "#lib/schemas.js";
import { logDraftDataSchema } from "#lib/schemas.js";
import { DBService, runQuery, type Database, type Transaction } from "#lib/server/db/index.js";
import { logDrafts, type LogDraft } from "#lib/server/db/schema.js";
import { logGetter, logSetter, type ErrorParams } from "#lib/server/effect/errors.js";
import { parse } from "#lib/server/effect/util.js";
import { R2_PUBLIC_URL } from "$app/env/public";
import { isTupleOf } from "@sillvva/utils";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Context, Data, Effect, Layer } from "effect";
import { v7 } from "uuid";

export class LogDraftError extends Data.TaggedError("LogDraftError")<ErrorParams> {
	constructor(message: string, status: ErrorParams["status"] = 400, err?: unknown) {
		super({ message, status, cause: err });
	}
}

function integer(value: unknown) {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Rows past the lifetime are treated as gone. The daily `delete-expired-log-drafts` pg_cron job
 * deletes them later (`supabase/migrations/20261103190000_log_draft_expiry_cron.sql`).
 */
const notExpired = () => gte(logDrafts.updatedAt, logDraftExpiryCutoff());

const countDrafts = (executor: Database | Transaction, userId: UserId) =>
	runQuery(
		executor
			.select({ count: sql<number>`count(*)::int` })
			.from(logDrafts)
			.where(and(eq(logDrafts.userId, userId), notExpired()))
	).pipe(Effect.map((rows) => integer(rows[0]?.count)));

/** Serializes draft creation per account so two requests cannot both pass the count check. */
const lockDraftUser = (tx: Transaction, userId: UserId) =>
	Effect.tryPromise({
		try: () => tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`log-draft:${userId}`}, 0))`),
		catch: (cause) => new LogDraftError("Could not save draft", 500, cause)
	});

function assertNoNewImages(data: LogDraftData) {
	if (!draftDescriptionHasNewImages(data.description, R2_PUBLIC_URL)) return Effect.void;
	return Effect.fail(new LogDraftError("Images can't be uploaded to a log draft."));
}

const notFound = () => new LogDraftError("Draft not found", 404);

function withData(row: LogDraft) {
	return parse(logDraftDataSchema, row.data).pipe(
		Effect.mapError((error) => new LogDraftError("Draft could not be read", 500, error)),
		Effect.map((data) => ({ ...row, data, expiresAt: row.updatedAt.getTime() + LOG_DRAFT_TTL_MS }))
	);
}

export type LogDraftRecord = Effect.Success<ReturnType<typeof withData>>;

export class LogDraftService extends Context.Service<LogDraftService>()("LogDraftService", {
	make: Effect.fn("LogDraftService")(function* () {
		const { db, transaction } = yield* DBService;

		/** Any signed-in user can read a draft by id. */
		const read = Effect.fn("LogDraftService.read")(
			function* (id: LogDraftId) {
				return yield* runQuery(
					db
						.select()
						.from(logDrafts)
						.where(and(eq(logDrafts.id, id), notExpired()))
						.limit(1)
				).pipe(
					Effect.flatMap((rows) => (isTupleOf(rows, 1) ? Effect.succeed(rows[0]) : Effect.fail(notFound()))),
					Effect.flatMap(withData)
				);
			},
			(effect, id) => logGetter(effect, "LogDraftService.read", { id })
		);

		/** Only the creator can open a draft for editing. Others get the same 404 as a missing draft. */
		const readOwned = Effect.fn("LogDraftService.readOwned")(
			function* (id: LogDraftId, userId: UserId) {
				const row = yield* read(id);
				if (row.userId !== userId) return yield* notFound();
				return row;
			},
			(effect, id, userId) => logGetter(effect, "LogDraftService.readOwned", { id, userId })
		);

		/** The user's live drafts, most recently saved first. */
		const list = Effect.fn("LogDraftService.list")(
			function* (userId: UserId) {
				return yield* runQuery(
					db
						.select()
						.from(logDrafts)
						.where(and(eq(logDrafts.userId, userId), notExpired()))
						.orderBy(desc(logDrafts.updatedAt))
				).pipe(Effect.flatMap((rows) => Effect.forEach(rows, withData)));
			},
			(effect, userId) => logGetter(effect, "LogDraftService.list", { userId })
		);

		const validate = (data: LogDraftData) =>
			assertNoNewImages(data).pipe(
				Effect.andThen(parse(logDraftDataSchema, data)),
				Effect.mapError((error) => (error instanceof LogDraftError ? error : new LogDraftError(error.message)))
			);

		const create = Effect.fn("LogDraftService.create")(
			function* (user: LocalsUser, data: LogDraftData) {
				const validated = yield* validate(data);

				return yield* transaction(
					Effect.fn(function* (tx) {
						yield* lockDraftUser(tx, user.id);
						const count = yield* countDrafts(tx, user.id);
						if (count >= LOG_DRAFT_LIMIT) {
							return yield* new LogDraftError(
								`You can keep up to ${LOG_DRAFT_LIMIT} log drafts. Delete one before creating another.`
							);
						}

						const now = new Date();
						const rows = yield* runQuery(
							tx
								.insert(logDrafts)
								.values({ id: v7() as LogDraftId, userId: user.id, data: validated, createdAt: now, updatedAt: now })
								.returning()
						);
						if (!isTupleOf(rows, 1)) return yield* new LogDraftError("Could not save draft", 500);
						return yield* withData(rows[0]);
					})
				);
			},
			(effect, user, data) => logSetter(effect, "LogDraftService.create", { userId: user.id, data })
		);

		/** Keeps the id, so the link and QR code stay valid. An expired draft cannot be revived. */
		const update = Effect.fn("LogDraftService.update")(
			function* (user: LocalsUser, id: LogDraftId, data: LogDraftData) {
				const validated = yield* validate(data);

				return yield* runQuery(
					db
						.update(logDrafts)
						.set({ data: validated, updatedAt: new Date() })
						.where(and(eq(logDrafts.id, id), eq(logDrafts.userId, user.id), notExpired()))
						.returning()
				).pipe(
					Effect.flatMap((rows) => (isTupleOf(rows, 1) ? Effect.succeed(rows[0]) : Effect.fail(notFound()))),
					Effect.flatMap(withData)
				);
			},
			(effect, user, id, data) => logSetter(effect, "LogDraftService.update", { userId: user.id, id, data })
		);

		const remove = Effect.fn("LogDraftService.remove")(
			function* (id: LogDraftId, userId: UserId) {
				return yield* runQuery(
					db
						.delete(logDrafts)
						.where(and(eq(logDrafts.id, id), eq(logDrafts.userId, userId)))
						.returning({ id: logDrafts.id })
				).pipe(Effect.flatMap((rows) => (isTupleOf(rows, 1) ? Effect.succeed(rows[0]) : Effect.fail(notFound()))));
			},
			(effect, id, userId) => logSetter(effect, "LogDraftService.remove", { id, userId })
		);

		return { read, readOwned, list, create, update, remove };
	})()
}) {
	static readonly layer = Layer.effect(this, this.make);
}

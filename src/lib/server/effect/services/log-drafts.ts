import { draftDescriptionHasNewImages, LOG_DRAFT_LIMIT, logDraftExpiryCutoff } from "#lib/log-draft.js";
import type { LocalsUser, LogDraftData, LogDraftId, UserId } from "#lib/schemas.js";
import { logDraftDataSchema } from "#lib/schemas.js";
import { DBService, runQuery, type Database, type Transaction } from "#lib/server/db/index.js";
import { logDrafts, type LogDraft } from "#lib/server/db/schema.js";
import { serializeError, type ErrorParams } from "#lib/server/effect/errors.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { parse } from "#lib/server/effect/util.js";
import { R2_PUBLIC_URL } from "$app/env/public";
import { isTupleOf } from "@sillvva/utils";
import { and, eq, lt, sql } from "drizzle-orm";
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

const deleteExpiredOn = (executor: Database | Transaction) =>
	runQuery(executor.delete(logDrafts).where(lt(logDrafts.updatedAt, logDraftExpiryCutoff())));

const countDrafts = (executor: Database | Transaction, userId: UserId) =>
	runQuery(
		executor
			.select({ count: sql<number>`count(*)::int` })
			.from(logDrafts)
			.where(eq(logDrafts.userId, userId))
	).pipe(Effect.map((rows) => integer(rows[0]?.count)));

function assertNoNewImages(data: LogDraftData) {
	if (!draftDescriptionHasNewImages(data.description, R2_PUBLIC_URL)) return Effect.void;
	return Effect.fail(new LogDraftError("Images can't be uploaded to a log draft."));
}

const readRow = (executor: Database | Transaction, id: LogDraftId) =>
	runQuery(executor.select().from(logDrafts).where(eq(logDrafts.id, id)).limit(1)).pipe(
		Effect.flatMap((rows) =>
			isTupleOf(rows, 1) ? Effect.succeed(rows[0]) : Effect.fail(new LogDraftError("Draft not found", 404))
		)
	);

function withData(row: LogDraft) {
	return parse(logDraftDataSchema, row.data).pipe(
		Effect.mapError((error) => new LogDraftError("Draft could not be read", 500, error)),
		Effect.map((data) => ({ ...row, data }))
	);
}

export class LogDraftService extends Context.Service<LogDraftService>()("LogDraftService", {
	make: Effect.fn("LogDraftService")(function* () {
		const { db, transaction } = yield* DBService;

		const deleteExpired = Effect.fn("LogDraftService.deleteExpired")(function* () {
			return yield* deleteExpiredOn(db).pipe(
				Effect.tapError((error) =>
					AppLog.error("LogDraftService.deleteExpired", { message: error.message, error: serializeError(error) })
				)
			);
		});

		const read = Effect.fn("LogDraftService.read")(function* (id: LogDraftId) {
			yield* deleteExpiredOn(db);
			return yield* readRow(db, id).pipe(
				Effect.flatMap(withData),
				Effect.tapError((error) => AppLog.debug("LogDraftService.read", { id, error: serializeError(error) }))
			);
		});

		const readOwned = Effect.fn("LogDraftService.readOwned")(function* (id: LogDraftId, userId: UserId) {
			const row = yield* read(id);
			if (row.userId !== userId) return yield* new LogDraftError("Draft not found", 404);
			return row;
		});

		const create = Effect.fn("LogDraftService.create")(function* (user: LocalsUser, data: LogDraftData) {
			yield* assertNoNewImages(data);
			const validated = yield* parse(logDraftDataSchema, data).pipe(Effect.mapError((error) => new LogDraftError(error.message)));

			return yield* transaction(
				Effect.fn(function* (tx) {
					yield* deleteExpiredOn(tx);
					const count = yield* countDrafts(tx, user.id);
					if (count >= LOG_DRAFT_LIMIT) {
						return yield* new LogDraftError(
							`You can keep up to ${LOG_DRAFT_LIMIT} log drafts. Delete one before creating another.`
						);
					}

					const now = new Date();
					const id = v7() as LogDraftId;
					const rows = yield* runQuery(
						tx.insert(logDrafts).values({ id, userId: user.id, data: validated, createdAt: now, updatedAt: now }).returning()
					);
					if (!isTupleOf(rows, 1)) return yield* new LogDraftError("Could not save draft", 500);
					return yield* withData(rows[0]);
				})
			).pipe(
				Effect.tap((result) => AppLog.info("LogDraftService.create", { id: result.id, userId: user.id })),
				Effect.tapError((error) => AppLog.debug("LogDraftService.create", { userId: user.id, error: serializeError(error) }))
			);
		});

		const update = Effect.fn("LogDraftService.update")(function* (user: LocalsUser, id: LogDraftId, data: LogDraftData) {
			yield* assertNoNewImages(data);
			const validated = yield* parse(logDraftDataSchema, data).pipe(Effect.mapError((error) => new LogDraftError(error.message)));

			return yield* transaction(
				Effect.fn(function* (tx) {
					yield* deleteExpiredOn(tx);
					const rows = yield* runQuery(
						tx
							.update(logDrafts)
							.set({ data: validated, updatedAt: new Date() })
							.where(and(eq(logDrafts.id, id), eq(logDrafts.userId, user.id)))
							.returning()
					);
					if (!isTupleOf(rows, 1)) return yield* new LogDraftError("Draft not found", 404);
					return yield* withData(rows[0]);
				})
			).pipe(
				Effect.tap((result) => AppLog.info("LogDraftService.update", { id: result.id, userId: user.id })),
				Effect.tapError((error) => AppLog.debug("LogDraftService.update", { id, userId: user.id, error: serializeError(error) }))
			);
		});

		const remove = Effect.fn("LogDraftService.remove")(function* (id: LogDraftId, userId: UserId) {
			return yield* runQuery(
				db
					.delete(logDrafts)
					.where(and(eq(logDrafts.id, id), eq(logDrafts.userId, userId)))
					.returning({ id: logDrafts.id })
			).pipe(
				Effect.flatMap((rows) =>
					isTupleOf(rows, 1) ? Effect.succeed(rows[0]) : Effect.fail(new LogDraftError("Draft not found", 404))
				),
				Effect.tap((result) => AppLog.info("LogDraftService.remove", { id: result.id, userId })),
				Effect.tapError((error) => AppLog.debug("LogDraftService.remove", { id, userId, error: serializeError(error) }))
			);
		});

		return { deleteExpired, read, readOwned, create, update, remove };
	})()
}) {
	static readonly layer = Layer.effect(this, this.make);
}

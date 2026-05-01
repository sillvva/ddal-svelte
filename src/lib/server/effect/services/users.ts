import { PROVIDERS } from "$lib/constants";
import type { PasskeyId, UserId } from "$lib/schemas";
import { DBService, runQuery, type Transaction } from "$lib/server/db";
import { passkey, user, type User } from "$lib/server/db/schema";
import { type ErrorParams } from "$lib/server/effect/errors";
import { AppLog } from "$lib/server/effect/logging";
import { isTupleOf, sorter } from "@sillvva/utils";
import { and, eq } from "drizzle-orm";
import { Data, Effect, Layer } from "effect";

export class UpdateUserError extends Data.TaggedError("UpdateUserError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Could not update user", status: 500, cause: err });
	}
}

export class RenamePasskeyError extends Data.TaggedError("RenamePasskeyError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Could not rename passkey", status: 500, cause: err });
	}
}

export class DeletePasskeyError extends Data.TaggedError("DeletePasskeyError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Could not delete passkey", status: 500, cause: err });
	}
}

export class UserService extends Effect.Service<UserService>()("UserService", {
	dependencies: [DBService.Default()],
	effect: Effect.fn("UserService")(function* () {
		const { db } = yield* DBService;

		return {
			get: {
				localsUser: Effect.fn("UserService.get.localsUser")(function* (userId: UserId) {
					return yield* runQuery(
						db.query.user.findFirst({
							with: {
								accounts: {
									columns: {
										id: true,
										accountId: true,
										providerId: true,
										scope: true,
										createdAt: true,
										updatedAt: true
									},
									where: {
										providerId: {
											in: PROVIDERS.map((p) => p.id)
										}
									}
								},
								passkeys: {
									columns: {
										id: true,
										name: true,
										createdAt: true
									}
								}
							},
							where: {
								id: {
									eq: userId
								}
							}
						})
					);
				}),
				users: Effect.fn("UserService.get.users")(function* () {
					return yield* runQuery(
						db.query.user.findMany({
							with: {
								accounts: {
									columns: {
										providerId: true
									}
								},
								characters: {
									columns: {
										id: true
									}
								}
							},
							where: {
								role: {
									ne: "admin"
								}
							}
						})
					).pipe(Effect.map((users) => users.sort((a, b) => sorter(a.name.toLowerCase(), b.name.toLowerCase()))));
				}),
				passkey: Effect.fn("UserService.get.passkey")(function* (userId: UserId, passkeyId: PasskeyId) {
					return yield* runQuery(
						db.query.passkey.findFirst({
							where: {
								id: { eq: passkeyId },
								userId: { eq: userId }
							}
						})
					);
				}),
				passkeys: Effect.fn("UserService.get.passkeys")(function* (userId: UserId) {
					return yield* runQuery(
						db.query.passkey.findMany({
							where: {
								userId: {
									eq: userId
								}
							}
						})
					);
				})
			},
			set: {
				update: Effect.fn("UserService.set.update")(function* (userId: UserId, data: Partial<Pick<User, "name" | "image">>) {
					return yield* runQuery(db.update(user).set(data).where(eq(user.id, userId)).returning()).pipe(
						Effect.flatMap((users) =>
							isTupleOf(users, 1) ? Effect.succeed(users[0]) : Effect.fail(new UpdateUserError("Failed to update user"))
						),
						Effect.tap((result) => AppLog.info("UserService.set.update", { userId, result })),
						Effect.tapError(() => AppLog.debug("UserService.set.update", { userId, data }))
					);
				}),
				renamePasskey: Effect.fn("UserService.set.renamePasskey")(function* (userId: UserId, passkeyId: PasskeyId, name: string) {
					return yield* runQuery(
						db
							.update(passkey)
							.set({ name: name.trim() })
							.where(and(eq(passkey.id, passkeyId), eq(passkey.userId, userId)))
							.returning()
					).pipe(
						Effect.flatMap((passkeys) =>
							isTupleOf(passkeys, 1)
								? Effect.succeed(passkeys[0])
								: Effect.fail(new RenamePasskeyError("Failed to rename passkey"))
						)
					);
				}),
				deletePasskey: Effect.fn("UserService.set.deletePasskey")(function* (userId: UserId, passkeyId: PasskeyId) {
					return yield* runQuery(
						db
							.delete(passkey)
							.where(and(eq(passkey.id, passkeyId), eq(passkey.userId, userId)))
							.returning({ id: passkey.id })
					).pipe(
						Effect.flatMap((passkeys) =>
							isTupleOf(passkeys, 1)
								? Effect.succeed(passkeys[0].id)
								: Effect.fail(new DeletePasskeyError("Failed to delete passkey"))
						)
					);
				})
			}
		};
	})
}) {}

export const UserTx = (tx: Transaction) => UserService.DefaultWithoutDependencies().pipe(Layer.provide(DBService.Default(tx)));

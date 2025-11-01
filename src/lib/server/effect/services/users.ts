import { PROVIDERS } from "$lib/constants";
import type { CharacterId, LocalsUser, PasskeyId, UserId } from "$lib/schemas";
import { DBService, runQuery, type DrizzleError, type Transaction } from "$lib/server/db";
import { passkey, user, type Passkey, type User } from "$lib/server/db/schema";
import { type ErrorParams } from "$lib/server/effect/errors";
import { AppLog } from "$lib/server/effect/logging";
import { sorter } from "@sillvva/utils";
import { and, eq } from "drizzle-orm";
import { Data, Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";

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

interface UserApiImpl {
	readonly get: {
		readonly localsUser: (userId: UserId) => Effect.Effect<LocalsUser | undefined, DrizzleError>;
		readonly users: () => Effect.Effect<(User & { characters: { id: CharacterId }[] })[], DrizzleError>;
		readonly passkey: (userId: UserId, passkeyId: PasskeyId) => Effect.Effect<Passkey | undefined, DrizzleError>;
		readonly passkeys: (userId: UserId) => Effect.Effect<Passkey[], DrizzleError>;
	};
	readonly set: {
		readonly update: (
			userId: UserId,
			data: Partial<Pick<User, "name" | "image">>
		) => Effect.Effect<User, UpdateUserError | DrizzleError>;
		readonly renamePasskey: (
			userId: UserId,
			passkeyId: PasskeyId,
			name: string
		) => Effect.Effect<Passkey, RenamePasskeyError | DrizzleError>;
		readonly deletePasskey: (userId: UserId, passkeyId: PasskeyId) => Effect.Effect<PasskeyId, DeletePasskeyError | DrizzleError>;
	};
}

export class UserService extends Effect.Service<UserService>()("UserService", {
	dependencies: [DBService.Default()],
	effect: Effect.fn("UserService")(function* () {
		const { db } = yield* DBService;

		const impl: UserApiImpl = {
			get: {
				localsUser: Effect.fn("UserService.get.localsUser")(function* (userId) {
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
				passkey: Effect.fn("UserService.get.passkey")(function* (userId, passkeyId) {
					return yield* runQuery(
						db.query.passkey.findFirst({
							where: {
								id: { eq: passkeyId },
								userId: { eq: userId }
							}
						})
					);
				}),
				passkeys: Effect.fn("UserService.get.passkeys")(function* (userId) {
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
				update: Effect.fn("UserService.set.update")(function* (userId, data) {
					return yield* runQuery(db.update(user).set(data).where(eq(user.id, userId)).returning()).pipe(
						Effect.flatMap((users) =>
							isTupleOf(users, 1) ? Effect.succeed(users[0]) : Effect.fail(new UpdateUserError("Failed to update user"))
						),
						Effect.tap((result) => AppLog.info("UserService.set.update", { userId, result })),
						Effect.tapError(() => AppLog.debug("UserService.set.update", { userId, data }))
					);
				}),
				renamePasskey: Effect.fn("UserService.set.renamePasskey")(function* (userId, passkeyId, name) {
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
				deletePasskey: Effect.fn("UserService.set.deletePasskey")(function* (userId, passkeyId) {
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

		return impl;
	})
}) {}

export const UserTx = (tx: Transaction) => UserService.DefaultWithoutDependencies().pipe(Layer.provide(DBService.Default(tx)));

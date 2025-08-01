import { PROVIDERS } from "$lib/constants";
import type { CharacterId, LocalsUser, UserId } from "$lib/schemas";
import { DBService, query, type DrizzleError, type Transaction } from "$server/db";
import { user, type User } from "$server/db/schema";
import { sorter } from "@sillvva/utils";
import { eq } from "drizzle-orm";
import { Data, Effect, Layer } from "effect";
import { isTupleOf } from "effect/Predicate";
import { debugSet, type ErrorParams } from ".";

export class UpdateUserError extends Data.TaggedError("UpdateUserError")<ErrorParams> {
	constructor(err?: unknown) {
		super({ message: "Could not update user", status: 500, cause: err });
	}
}

interface UserApiImpl {
	readonly get: {
		readonly localsUser: (userId: UserId) => Effect.Effect<LocalsUser | undefined, DrizzleError>;
		readonly users: (userId: UserId) => Effect.Effect<(User & { characters: { id: CharacterId }[] })[], DrizzleError>;
	};
	readonly set: {
		readonly update: (
			userId: UserId,
			data: Partial<Pick<User, "name" | "image">>
		) => Effect.Effect<User, UpdateUserError | DrizzleError>;
	};
}

export class UserService extends Effect.Service<UserService>()("UserService", {
	effect: Effect.fn("UserService")(function* () {
		const { db } = yield* DBService;

		const impl: UserApiImpl = {
			get: {
				localsUser: Effect.fn("UserService.get.localsUser")(function* (userId) {
					return yield* query(
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
				users: Effect.fn("UserService.get.users")(function* (userId) {
					return yield* query(
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
								id: {
									ne: userId
								}
							}
						})
					).pipe(Effect.map((users) => users.sort((a, b) => sorter(a.name.toLowerCase(), b.name.toLowerCase()))));
				})
			},
			set: {
				update: Effect.fn("UserService.set.update")(function* (userId, data) {
					return yield* query(db.update(user).set(data).where(eq(user.id, userId)).returning()).pipe(
						Effect.flatMap((users) =>
							isTupleOf(users, 1) ? Effect.succeed(users[0]) : Effect.fail(new UpdateUserError("Failed to update user"))
						)
					);
				})
			}
		};

		return impl;
	}),
	dependencies: [DBService.Default()]
}) {}

export const UserTx = (tx: Transaction) => UserService.DefaultWithoutDependencies().pipe(Layer.provide(DBService.Default(tx)));

export const withUser = Effect.fn("withUser")(
	function* <R, E extends UpdateUserError | DrizzleError>(impl: (service: UserApiImpl) => Effect.Effect<R, E>) {
		const userApi = yield* UserService;
		const result = yield* impl(userApi);

		yield* debugSet("UserService", impl, result);

		return result;
	},
	(effect) => effect.pipe(Effect.provide(UserService.Default()))
);

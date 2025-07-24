import { PROVIDERS } from "$lib/constants";
import type { CharacterId, LocalsUser, UserId } from "$lib/schemas";
import { DBService, type Transaction } from "$server/db";
import type { User } from "$server/db/schema";
import { sorter } from "@sillvva/utils";
import { Effect, Layer } from "effect";

interface UserApiImpl {
	readonly get: {
		readonly localsUser: (userId: UserId) => Effect.Effect<LocalsUser | undefined>;
		readonly users: (userId: UserId) => Effect.Effect<(User & { characters: { id: CharacterId }[] })[]>;
	};
}

export class UserService extends Effect.Service<UserService>()("UserService", {
	effect: Effect.gen(function* () {
		const { db } = yield* DBService;

		const impl: UserApiImpl = {
			get: {
				localsUser: (userId) =>
					Effect.promise(() =>
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
					),
				users: (userId: UserId) =>
					Effect.promise(() =>
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
					).pipe(Effect.map((users) => users.sort((a, b) => sorter(a.name.toLowerCase(), b.name.toLowerCase()))))
			}
		};

		return impl;
	}),
	dependencies: [DBService.Default()]
}) {}

export const UserTx = (tx: Transaction) => UserService.DefaultWithoutDependencies.pipe(Layer.provide(DBService.Default(tx)));

export const withUser = Effect.fn("withUser")(<R>(impl: (service: UserApiImpl) => Effect.Effect<R>) =>
	Effect.gen(function* () {
		const userApi = yield* UserService;
		return yield* impl(userApi);
	}).pipe(Effect.provide(UserService.Default))
);

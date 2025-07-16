import { PROVIDERS } from "$lib/constants";
import type { LocalsUser, UserId } from "$lib/schemas";
import { db, type Database, type Transaction } from "$server/db";
import { Effect, Layer } from "effect";
import { DBService, FetchError } from ".";

class FetchUserError extends FetchError {}
function createFetchError(err: unknown): FetchUserError {
	return FetchUserError.from(err);
}

interface UserApiImpl {
	readonly getLocalsUser: (userId: UserId) => Effect.Effect<LocalsUser | undefined, FetchUserError>;
}

export class UserService extends Effect.Service<UserService>()("UserService", {
	effect: Effect.gen(function* () {
		const { db } = yield* DBService;

		const impl: UserApiImpl = {
			getLocalsUser: (userId) =>
				Effect.tryPromise({
					try: () =>
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
						}),
					catch: createFetchError
				})
		};

		return impl;
	})
}) {}

export const UserLive = (dbOrTx: Database | Transaction = db) =>
	UserService.Default.pipe(Layer.provide(DBService.Default(dbOrTx)));

export function withUser<R, E extends FetchUserError>(
	impl: (service: UserApiImpl) => Effect.Effect<R, E>,
	dbOrTx: Database | Transaction = db
) {
	return Effect.gen(function* () {
		const userApi = yield* UserService;
		return yield* impl(userApi);
	}).pipe(Effect.provide(UserLive(dbOrTx)));
}

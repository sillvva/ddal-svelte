import { PROVIDERS } from "$lib/constants";
import type { LocalsUser, UserId } from "$lib/schemas";
import { db, type Database, type Transaction } from "$server/db";
import { Context, Effect, Layer } from "effect";
import { DBService, FetchError, withLiveDB } from ".";

class FetchUserError extends FetchError {}
function createFetchError(err: unknown): FetchUserError {
	return FetchUserError.from(err);
}

interface UserApiImpl {
	readonly getLocalsUser: (userId: UserId) => Effect.Effect<LocalsUser | undefined, FetchUserError>;
}

export class UserApi extends Context.Tag("UserApi")<UserApi, UserApiImpl>() {}

const UserApiLive = Layer.effect(
	UserApi,
	Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

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
);

export const UserLive = (dbOrTx: Database | Transaction = db) => UserApiLive.pipe(Layer.provide(withLiveDB(dbOrTx)));

export function withUser<R, E extends FetchUserError>(
	impl: (service: UserApiImpl) => Effect.Effect<R, E>,
	dbOrTx: Database | Transaction = db
) {
	return Effect.gen(function* () {
		const UserService = yield* UserApi;
		return yield* impl(UserService);
	}).pipe(Effect.provide(UserLive(dbOrTx)));
}

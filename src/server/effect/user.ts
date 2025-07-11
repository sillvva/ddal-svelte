import { PROVIDERS } from "$lib/constants";
import type { LocalsUser, UserId } from "$lib/schemas";
import { db, type Database, type Transaction } from "$server/db";
import { Context, Effect, Layer } from "effect";
import { DBService, FetchError, withLiveDB } from ".";

class FetchUserError extends FetchError {}
function createFetchError(err: unknown): FetchUserError {
	return FetchUserError.from(err);
}

interface FetchUserApiImpl {
	readonly getLocalsUser: (userId: UserId) => Effect.Effect<LocalsUser | undefined, FetchUserError>;
}

export class FetchUserApi extends Context.Tag("FetchUserApi")<FetchUserApi, FetchUserApiImpl>() {}

const FetchUserApiLive = Layer.effect(
	FetchUserApi,
	Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		return {
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
	})
);

export const FetchUserLive = (dbOrTx: Database | Transaction = db) => FetchUserApiLive.pipe(Layer.provide(withLiveDB(dbOrTx)));

export function withFetchUser<R, E extends FetchUserError>(
	impl: (service: FetchUserApiImpl) => Effect.Effect<R, E>,
	dbOrTx: Database | Transaction = db
) {
	return Effect.gen(function* () {
		const FetchUserService = yield* FetchUserApi;
		return yield* impl(FetchUserService);
	}).pipe(Effect.provide(FetchUserLive(dbOrTx)));
}

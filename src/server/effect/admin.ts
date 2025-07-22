import { DBService, type Transaction } from "$server/db";
import type { AppLog } from "$server/db/schema";
import { Effect, Layer, LogLevel } from "effect";
import { FetchError } from ".";

class FetchAdminError extends FetchError {}
function createFetchError(err: unknown): FetchAdminError {
	return FetchAdminError.from(err);
}

interface AdminApiImpl {
	readonly get: {
		readonly logs: (filter?: { logLevels: LogLevel.LogLevel["label"][] }) => Effect.Effect<AppLog[], FetchAdminError>;
	};
}

export class AdminService extends Effect.Service<AdminService>()("AdminService", {
	effect: Effect.gen(function* () {
		const { db } = yield* DBService;

		const impl: AdminApiImpl = {
			get: {
				logs: (
					filter = {
						logLevels: ["ERROR"]
					}
				) =>
					Effect.tryPromise({
						try: () =>
							db.query.appLogs.findMany({
								where: {
									level: {
										in: filter.logLevels
									}
								},
								orderBy: {
									timestamp: "desc"
								}
							}),
						catch: createFetchError
					})
			}
		};

		return impl;
	}),
	dependencies: [DBService.Default()]
}) {}

export const AdminTx = (tx: Transaction) => AdminService.DefaultWithoutDependencies.pipe(Layer.provide(DBService.Default(tx)));

export const withAdmin = Effect.fn("withAdmin")(
	<R, E extends FetchAdminError>(impl: (service: AdminApiImpl) => Effect.Effect<R, E>) =>
		Effect.gen(function* () {
			const adminApi = yield* AdminService;
			return yield* impl(adminApi);
		}).pipe(Effect.provide(AdminService.Default))
);

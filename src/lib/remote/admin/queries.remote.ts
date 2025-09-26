import { query } from "$app/server";
import { guardedQuery } from "$lib/server/effect/remote";
import { run } from "$lib/server/effect/runtime";
import { AdminService, validKeys } from "$lib/server/effect/services/admin";
import { UserService } from "$lib/server/effect/services/users";
import { getTrace } from "$lib/util";
import { DateTime, Effect } from "effect";
import * as v from "valibot";

export const getBaseSearch = query(() =>
	run(function* () {
		const today = yield* DateTime.now;
		const weekAgo = today.pipe(DateTime.subtract({ days: 7 }));
		const range = `${DateTime.formatIsoDateUtc(weekAgo)}..${DateTime.formatIsoDateUtc(today)}`;
		return { query: `date:${range}`, validKeys };
	})
);

export const getAppLogs = guardedQuery(
	v.string(),
	function* (search) {
		const Admin = yield* AdminService;

		const { logs, metadata } = yield* Admin.get.logs(search).pipe(
			Effect.map(({ logs, metadata }) => ({
				logs: logs.map((log) => {
					const err = log.annotations.extra.error as { stack?: string } | undefined;
					const trace = getTrace(err?.stack ?? log.label);
					if (err?.stack) log.annotations.extra.error = "See stack for more details";
					return {
						...log,
						...trace
					};
				}),
				metadata
			}))
		);

		return { logs, metadata };
	},
	true
);

export const getUsers = guardedQuery(function* () {
	const Users = yield* UserService;

	return yield* Users.get.users().pipe(
		Effect.map((users) =>
			users.map((user) => ({
				...user,
				characters: user.characters.length
			}))
		)
	);
}, true);

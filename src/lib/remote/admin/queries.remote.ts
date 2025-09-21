import { query } from "$app/server";
import { run } from "$lib/server/effect/runtime";
import { AdminService, validKeys } from "$lib/server/effect/services/admin";
import { assertAuth } from "$lib/server/effect/services/auth";
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

export const getAppLogs = query(v.string(), (search) =>
	run(function* () {
		yield* assertAuth(true);
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
	})
);

export const getUsers = query(() =>
	run(function* () {
		yield* assertAuth(true);
		const Users = yield* UserService;

		return yield* Users.get.users().pipe(
			Effect.map((users) =>
				users.map((user) => ({
					...user,
					characters: user.characters.length
				}))
			)
		);
	})
);

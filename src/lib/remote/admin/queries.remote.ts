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
		const yesterday = today.pipe(DateTime.subtract({ days: 1 }));
		const range = `${DateTime.formatIsoDateUtc(yesterday)}..${DateTime.formatIsoDateUtc(today)}`;
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
					const trace = getTrace(log.label);
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

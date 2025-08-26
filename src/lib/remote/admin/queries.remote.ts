import { query } from "$app/server";
import { run, runAuth } from "$lib/server/effect/runtime";
import { AdminService, validKeys } from "$lib/server/effect/services/admin";
import { UserService } from "$lib/server/effect/services/users";
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
	runAuth(
		function* () {
			const Admin = yield* AdminService;

			const { logs, metadata } = yield* Admin.get.logs(search).pipe(
				Effect.map(({ logs, metadata }) => ({
					logs: logs.map((log) => {
						const parts = log.label.split(/\n\s+\b/).map((part) => part.trim());
						const message = parts.shift();
						const trace = parts.join("\n");
						return {
							...log,
							message,
							trace
						};
					}),
					metadata
				}))
			);

			return { logs, metadata };
		},
		{ adminOnly: true }
	)
);

export const getUsers = query(() =>
	runAuth(
		function* () {
			const Users = yield* UserService;

			return yield* Users.get.users().pipe(
				Effect.map((users) =>
					users.map((user) => ({
						...user,
						characters: user.characters.length
					}))
				)
			);
		},
		{ adminOnly: true }
	)
);

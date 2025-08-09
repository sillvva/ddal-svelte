import { command, query } from "$app/server";
import { appLogId } from "$lib/schemas";
import { AdminService, validKeys } from "$lib/server/effect/admin";
import { authRedirect, authReturn, runOrThrow } from "$lib/server/effect/runtime";
import { UserService } from "$lib/server/effect/users";
import { DateTime, Effect } from "effect";
import * as v from "valibot";

export const getBaseSearch = query(() =>
	runOrThrow(function* () {
		const today = yield* DateTime.now;
		const yesterday = today.pipe(DateTime.subtract({ days: 1 }));
		const range = `${DateTime.formatIsoDateUtc(yesterday)}..${DateTime.formatIsoDateUtc(today)}`;
		return { query: `date:${range}`, validKeys };
	})
);

export const getAppLogs = query(v.string(), (search) =>
	authRedirect(function* () {
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
	}, true)
);

export const deleteAppLog = command(appLogId, (id) =>
	authReturn(function* () {
		const Admin = yield* AdminService;
		return yield* Admin.set.deleteLog(id);
	}, true)
);

export const getUsers = query(() =>
	authRedirect(function* () {
		const Users = yield* UserService;

		return yield* Users.get.users().pipe(
			Effect.map((users) =>
				users.map((user) => ({
					...user,
					characters: user.characters.length
				}))
			)
		);
	}, true)
);

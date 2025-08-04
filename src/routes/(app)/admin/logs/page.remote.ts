import { command, query } from "$app/server";
import { appLogId } from "$lib/schemas";
import { assertAuth } from "$lib/server/auth";
import { run, runRemote } from "$lib/server/effect";
import { validKeys, withAdmin } from "$lib/server/effect/admin";
import { DateTime, Effect } from "effect";
import * as v from "valibot";

const baseSearchFn = Effect.fn("baseSearchFn")(function* () {
	const today = yield* DateTime.now;
	const yesterday = today.pipe(DateTime.subtract({ days: 1 }));
	const range = `${DateTime.formatIsoDateUtc(yesterday)}..${DateTime.formatIsoDateUtc(today)}`;
	return { query: `date:${range}`, validKeys };
});

export const getBaseSearch = query(() => run(baseSearchFn));

export const getLogs = query(v.string(), (search) =>
	run(function* () {
		yield* assertAuth(true);

		const { logs, metadata } = yield* withAdmin((service) =>
			service.get.logs(search).pipe(
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
			)
		);

		return { logs, metadata };
	})
);

export const deleteLog = command(appLogId, (id) =>
	runRemote(function* () {
		yield* assertAuth(true);
		return yield* withAdmin((service) => service.set.deleteLog(id));
	})
);

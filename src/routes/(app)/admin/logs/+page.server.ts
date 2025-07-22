import { assertUser } from "$server/auth.js";
import { run } from "$server/effect";
import { withAdmin } from "$server/effect/admin.js";
import { Effect } from "effect";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user);

	const today = new Date().toISOString().split("T")[0];
	const search = event.url.searchParams.get("s") ?? `level:ERROR date:${today}`;

	const { logs, metadata } = await run(
		withAdmin((service) =>
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
		)
	);

	return { logs, metadata, search };
};

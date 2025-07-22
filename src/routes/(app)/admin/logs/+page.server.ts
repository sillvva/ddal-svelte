import { assertUser } from "$server/auth.js";
import { run } from "$server/effect";
import { withAdmin } from "$server/effect/admin.js";
import { Effect } from "effect";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user);

	const logs = await run(
		withAdmin((service) =>
			service.get.logs().pipe(
				Effect.map((logs) =>
					logs.map((log) => {
						const parts = log.label.split(/\n\s+\b/).map((part) => part.trim());
						const message = parts.shift();
						const trace = parts.join("\n");
						return {
							...log,
							message,
							trace
						};
					})
				)
			)
		)
	);

	return { logs };
};

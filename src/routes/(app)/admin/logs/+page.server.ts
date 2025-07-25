import { appLogId } from "$lib/schemas";
import { assertUser } from "$server/auth.js";
import { run, save, validateForm } from "$server/effect";
import { validKeys, withAdmin } from "$server/effect/admin.js";
import { fail } from "@sveltejs/kit";
import { DateTime, Effect } from "effect";
import { setError } from "sveltekit-superforms";
import { object } from "valibot";

export const load = async (event) =>
	run(function* () {
		const user = event.locals.user;
		assertUser(user);

		const today = yield* DateTime.now;
		const yesterday = today.pipe(DateTime.subtract({ days: 1 }));
		const range = `${DateTime.formatIsoDateUtc(yesterday)}..${DateTime.formatIsoDateUtc(today)}`;
		const search = event.url.searchParams.get("s") ?? `level:error date:${range}`;

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

		return { logs, metadata, search, validKeys };
	});

export const actions = {
	deleteLog: (event) =>
		run(function* () {
			const user = event.locals.user;
			assertUser(user);

			if (user.role !== "admin") return fail(403, { message: "You are not authorized to delete logs" });

			const form = yield* validateForm(event, object({ id: appLogId }));
			if (!form.valid) return fail(400, { form });

			return save(
				withAdmin((service) => service.set.deleteLog(form.data.id)),
				{
					onError: (err) => {
						setError(form, "", err.message);
						return fail(err.status, { form });
					},
					onSuccess: () => ({ form })
				}
			);
		})
};

import { defaultLogData, logDataToSchema } from "$lib/entities.js";
import { dMLogSchema, logIdSchema } from "$lib/schemas";
import { assertUser } from "$server/auth";
import { runOrThrow, save, validateForm } from "$server/effect";
import { withCharacter } from "$server/effect/characters.js";
import { withLog } from "$server/effect/logs";
import { error, redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import { fail } from "sveltekit-superforms";
import { safeParse } from "valibot";

export const load = (event) =>
	runOrThrow(
		Effect.gen(function* () {
			const user = event.locals.user;
			assertUser(user);

			const parent = yield* Effect.promise(() => event.parent());

			const idResult = safeParse(logIdSchema, event.params.logId || "");
			if (!idResult.success) redirect(302, `/dm-logs`);
			const logId = idResult.output;

			const characters = yield* withCharacter((service) => service.getUserCharacters(user.id, true)).pipe(
				Effect.map((characters) =>
					characters.map((c) => ({
						...c,
						logs: c.logs.filter((l) => l.id !== logId),
						magicItems: [],
						storyAwards: [],
						logLevels: []
					}))
				)
			);

			let log = (yield* withLog((service) => service.getLog(logId, user.id))) || defaultLogData(user.id);
			if (logId !== "new") {
				if (!log.id) error(404, "Log not found");
				if (!log.isDmLog) redirect(302, `/characters/${log.characterId}/log/${log.id}`);
			}

			const form = yield* validateForm(logDataToSchema(user.id, log), dMLogSchema(characters));

			return {
				...event.params,
				title: logId === "new" ? "New DM Log" : `Edit ${form.data.name}`,
				breadcrumbs: parent.breadcrumbs.concat({
					name: logId === "new" ? "New DM Log" : `${form.data.name}`,
					href: `/dm-logs/${logId}`
				}),
				characters: characters.map((c) => ({ id: c.id, name: c.name })),
				form
			};
		})
	);

export const actions = {
	saveLog: (event) =>
		runOrThrow(
			Effect.gen(function* () {
				const user = event.locals.user;
				assertUser(user);

				const idResult = safeParse(logIdSchema, event.params.logId || "");
				if (!idResult.success) redirect(302, `/dm-logs`);
				const logId = idResult.output;

				const log = yield* withLog((service) => service.getLog(logId, user.id));
				if (logId !== "new" && !log?.id) redirect(302, `/dm-logs`);

				const characters = yield* withCharacter((service) => service.getUserCharacters(user.id, true));

				const form = yield* validateForm(event, dMLogSchema(characters));
				if (!form.valid) return fail(400, { form });

				return save(
					withLog((service) => service.saveLog(form.data, user)),
					{
						onError: (err) => err.toForm(form),
						onSuccess: () => `/dm-logs`
					}
				);
			})
		)
};

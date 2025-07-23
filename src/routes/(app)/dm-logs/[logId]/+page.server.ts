import { defaultLogData, logDataToSchema } from "$lib/entities.js";
import { dMLogSchema, logIdSchema, uuidOrNew } from "$lib/schemas";
import { assertUser } from "$server/auth";
import { run, save, validateForm } from "$server/effect";
import { withCharacter } from "$server/effect/characters.js";
import { FetchLogError, withLog } from "$server/effect/logs";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import { fail } from "sveltekit-superforms";

export const load = (event) =>
	run(function* () {
		const user = event.locals.user;
		assertUser(user);

		const idResult = uuidOrNew(event.params.logId || "", logIdSchema);
		if (!idResult.success) redirect(302, `/dm-logs`);
		const logId = idResult.output;

		const characters = yield* withCharacter((service) => service.get.userCharacters(user.id, true)).pipe(
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

		let log = (logId !== "new" && (yield* withLog((service) => service.get.log(logId, user.id)))) || defaultLogData(user.id);

		if (logId !== "new") {
			if (!log.id) return yield* new FetchLogError("Log not found", 404);
			if (!log.isDmLog) redirect(302, `/characters/${log.characterId}/log/${log.id}`);
		}

		const form = yield* validateForm(logDataToSchema(user.id, log), dMLogSchema(characters));

		return {
			...event.params,
			characters: characters.map((c) => ({ id: c.id, name: c.name })),
			form
		};
	});

export const actions = {
	saveLog: (event) =>
		run(function* () {
			const user = event.locals.user;
			assertUser(user);

			const idResult = uuidOrNew(event.params.logId || "", logIdSchema);
			if (!idResult.success) redirect(302, `/dm-logs`);
			const logId = idResult.output;

			const log = logId !== "new" ? yield* withLog((service) => service.get.log(logId, user.id)) : undefined;
			if (logId !== "new" && !log?.id) redirect(302, `/dm-logs`);

			const characters = yield* withCharacter((service) => service.get.userCharacters(user.id, true));

			const form = yield* validateForm(event, dMLogSchema(characters));
			if (!form.valid) return fail(400, { form });

			return save(
				withLog((service) => service.set.save(form.data, user)),
				{
					onError: (err) => err.toForm(form),
					onSuccess: () => `/dm-logs`
				}
			);
		})
};

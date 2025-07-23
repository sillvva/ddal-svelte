import { defaultLogData, getItemEntities, logDataToSchema } from "$lib/entities.js";
import { characterIdSchema, characterLogSchema, logIdSchema, uuidOrNew } from "$lib/schemas";
import { assertUser } from "$server/auth";
import { run, save, validateForm } from "$server/effect";
import { FetchCharacterError, withCharacter } from "$server/effect/characters.js";
import { withDM } from "$server/effect/dms.js";
import { FetchLogError, withLog } from "$server/effect/logs.js";
import { sorter } from "@sillvva/utils";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import { fail } from "sveltekit-superforms";
import * as v from "valibot";

export const load = (event) =>
	run(function* () {
		const user = event.locals.user;
		assertUser(user);

		const parent = yield* Effect.promise(event.parent);
		const character = parent.character;
		if (!character) return yield* new FetchCharacterError("Character not found", 404);

		const idResult = uuidOrNew(event.params.logId || "", logIdSchema);
		if (!idResult.success) redirect(302, `/character/${character.id}`);
		const logId = idResult.output;

		const log =
			(logId !== "new" && (yield* withLog((service) => service.get.log(logId, user.id)))) || defaultLogData(user.id, character);

		if (logId !== "new") {
			if (!log.id) return yield* new FetchLogError("Log not found", 404);
			if (log.isDmLog) redirect(302, `/dm-logs/${log.id}`);
		}

		const form = yield* validateForm(logDataToSchema(user.id, log), characterLogSchema(character));

		const itemEntities = getItemEntities(character, { excludeDropped: true, lastLogId: log.id });
		const magicItems = itemEntities.magicItems.toSorted((a, b) => sorter(a.name, b.name));
		const storyAwards = itemEntities.storyAwards.toSorted((a, b) => sorter(a.name, b.name));
		const dms = yield* withDM((service) => service.get.userDMs(user, { includeLogs: true }));

		return {
			...event.params,
			totalLevel: character.totalLevel,
			user: { ...user, ...parent.user },
			magicItems,
			storyAwards,
			dms,
			form,
			firstLog: event.url.searchParams.get("firstLog") === "true"
		};
	});

export const actions = {
	saveLog: (event) =>
		run(function* () {
			const user = event.locals.user;
			assertUser(user);

			const result = v.safeParse(characterIdSchema, event.params.characterId);
			if (!result.success) throw redirect(302, "/characters?uuid=1");
			const characterId = result.output;

			const character = yield* withCharacter((service) => service.get.character(characterId));
			if (!character) redirect(302, "/characters");

			const idResult = uuidOrNew(event.params.logId || "", logIdSchema);
			if (!idResult.success) redirect(302, `/character/${character.id}`);
			const logId = idResult.output;

			const log = logId !== "new" ? yield* withLog((service) => service.get.log(logId, user.id)) : undefined;
			if (logId !== "new" && !log?.id) redirect(302, `/characters/${character.id}`);

			const form = yield* validateForm(event, characterLogSchema(character));
			if (!form.valid) return fail(400, { form });

			return save(
				withLog((service) => service.set.save(form.data, user)),
				{
					onError: (err) => err.toForm(form),
					onSuccess: () => `/characters/${character.id}`
				}
			);
		})
};

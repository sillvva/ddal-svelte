import { defaultLogSchema, getItemEntities, logDataToSchema } from "$lib/entities.js";
import { characterIdSchema, characterLogSchema, logIdOrNewSchema } from "$lib/schemas";
import { assertAuth } from "$lib/server/auth";
import { run, save, validateForm } from "$lib/server/effect";
import { CharacterNotFoundError, withCharacter } from "$lib/server/effect/characters.js";
import { withDM } from "$lib/server/effect/dms.js";
import { LogNotFoundError, withLog } from "$lib/server/effect/logs.js";
import { sorter } from "@sillvva/utils";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import { fail } from "sveltekit-superforms";
import * as v from "valibot";

export const load = (event) =>
	run(function* () {
		const user = yield* assertAuth();

		const parent = yield* Effect.promise(event.parent);
		const character = parent.character;
		if (!character) return yield* new CharacterNotFoundError();

		const idResult = v.safeParse(logIdOrNewSchema, event.params.logId);
		if (!idResult.success) redirect(307, `/character/${character.id}`);
		const logId = idResult.output;

		const logData = yield* withLog((service) => service.get.log(logId, user.id));
		let log = logData ? logDataToSchema(user.id, logData) : defaultLogSchema(user.id, character);

		if (logId !== "new") {
			if (!log.id) return yield* new LogNotFoundError();
			if (log.isDmLog) redirect(307, `/dm-logs/${log.id}`);
		}

		const form = yield* validateForm(log, characterLogSchema(character));

		const itemEntities = getItemEntities(character, { excludeDropped: true, lastLogId: log.id });
		const magicItems = itemEntities.magicItems.toSorted((a, b) => sorter(a.name, b.name));
		const storyAwards = itemEntities.storyAwards.toSorted((a, b) => sorter(a.name, b.name));
		const dms = yield* withDM((service) => service.get.userDMs(user.id));

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
			const user = yield* assertAuth();

			const characterId = v.parse(characterIdSchema, event.params.characterId);
			const character = yield* withCharacter((service) => service.get.character(characterId));
			if (!character) redirect(302, "/characters");

			const idResult = v.safeParse(logIdOrNewSchema, event.params.logId);
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

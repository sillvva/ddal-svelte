import { defaultLogData, getItemEntities, logDataToSchema } from "$lib/entities.js";
import { characterIdSchema, characterLogSchema, logIdSchema } from "$lib/schemas";
import { saveLog } from "$server/actions/logs.js";
import { assertUser } from "$server/auth";
import { getCharacter } from "$server/data/characters";
import { getUserDMs } from "$server/data/dms";
import { getLog } from "$server/data/logs";
import { fetchWithFallback, save } from "$server/db/effect";
import { sorter } from "@sillvva/utils";
import { error, redirect } from "@sveltejs/kit";
import { fail, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { parse, safeParse } from "valibot";

export const load = async (event) => {
	const user = event.locals.user;
	assertUser(user);

	const parent = await event.parent();
	const character = parent.character;
	if (!character) error(404, "Character not found");

	const idResult = safeParse(logIdSchema, event.params.logId || "");
	if (!idResult.success) redirect(302, `/character/${character.id}`);
	const logId = idResult.output;

	let log = (await fetchWithFallback(getLog(logId, user.id), () => undefined)) || defaultLogData(user.id, character);
	if (logId !== "new") {
		if (!log.id) error(404, "Log not found");
		if (log.isDmLog) redirect(302, `/dm-logs/${log.id}`);
	}

	const form = await superValidate(logDataToSchema(user.id, log), valibot(characterLogSchema(character)), {
		errors: logId !== "new"
	});

	const itemEntities = getItemEntities(character, { excludeDropped: true, lastLogId: log.id });
	const magicItems = itemEntities.magicItems.toSorted((a, b) => sorter(a.name, b.name));
	const storyAwards = itemEntities.storyAwards.toSorted((a, b) => sorter(a.name, b.name));
	const dms = await fetchWithFallback(getUserDMs(user), () => []);

	return {
		...event.params,
		title: logId === "new" ? `New Log - ${character.name}` : `Edit ${form.data.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: logId === "new" ? `New Log` : form.data.name,
			href: `/characters/${character.id}/log/${form.data.id}`
		}),
		totalLevel: character.totalLevel,
		user: { ...user, ...parent.user },
		magicItems,
		storyAwards,
		dms,
		form,
		firstLog: event.url.searchParams.get("firstLog") === "true"
	};
};

export const actions = {
	saveLog: async (event) => {
		const user = event.locals.user;
		assertUser(user);

		const characterId = parse(characterIdSchema, event.params.characterId);
		const character = await fetchWithFallback(getCharacter(characterId), () => undefined);
		if (!character) redirect(302, "/characters");

		const idResult = safeParse(logIdSchema, event.params.logId || "");
		if (!idResult.success) redirect(302, `/character/${character.id}`);
		const logId = idResult.output;

		const log = await fetchWithFallback(getLog(logId, user.id), () => undefined);
		if (logId !== "new" && !log?.id) redirect(302, `/characters/${character.id}`);

		const form = await superValidate(event, valibot(characterLogSchema(character)));
		if (!form.valid) return fail(400, { form });

		return await save(saveLog(form.data, user), {
			onError: (err) => err.toForm(form),
			onSuccess: () => `/characters/${character.id}`
		});
	}
};

import { defaultLogData, getItemEntities, logDataToSchema } from "$lib/entities.js";
import { characterIdSchema, characterLogSchema, logIdSchema } from "$lib/schemas";
import { SaveError } from "$lib/util.js";
import { saveLog } from "$server/actions/logs.js";
import { assertUser } from "$server/auth.js";
import { getCharacter } from "$server/data/characters";
import { getUserDMs } from "$server/data/dms";
import { getLog } from "$server/data/logs";
import { sorter } from "@sillvva/utils";
import { error, redirect } from "@sveltejs/kit";
import { fail, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { parse, safeParse } from "valibot";

export const load = async (event) => {
	const session = event.locals.session;
	assertUser(session?.user, event.url);

	const parent = await event.parent();
	const character = parent.character;
	if (!character) error(404, "Character not found");

	const idResult = safeParse(logIdSchema, event.params.logId || "");
	if (!idResult.success) redirect(302, `/character/${character.id}`);
	const logId = idResult.output;

	let log = (await getLog(logId, session.user.id)) || defaultLogData(session.user.id, character.id);
	if (logId !== "new") {
		if (!log.id) error(404, "Log not found");
		if (log.isDmLog) redirect(302, `/dm-logs/${log.id}`);
	}

	const form = await superValidate(logDataToSchema(session.user.id, log), valibot(characterLogSchema(character)), {
		errors: logId !== "new"
	});

	const itemEntities = getItemEntities(character, { excludeDropped: true, lastLogId: log.id });
	const magicItems = itemEntities.magicItems.toSorted((a, b) => sorter(a.name, b.name));
	const storyAwards = itemEntities.storyAwards.toSorted((a, b) => sorter(a.name, b.name));
	const dms = await getUserDMs(session.user);

	return {
		...event.params,
		title: logId === "new" ? `New Log - ${character.name}` : `Edit ${form.data.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: logId === "new" ? `New Log` : form.data.name,
			href: `/characters/${character.id}/log/${form.data.id}`
		}),
		totalLevel: character.total_level,
		user: { ...session.user, ...parent.user },
		magicItems,
		storyAwards,
		dms,
		form,
		firstLog: event.url.searchParams.get("firstLog") === "true"
	};
};

export const actions = {
	saveLog: async (event) => {
		const session = event.locals.session;
		assertUser(session?.user, event.url);

		const characterId = parse(characterIdSchema, event.params.characterId);
		const character = await getCharacter(characterId);
		if (!character) redirect(302, "/characters");

		const idResult = safeParse(logIdSchema, event.params.logId || "");
		if (!idResult.success) redirect(302, `/character/${character.id}`);
		const logId = idResult.output;

		const log = await getLog(logId, session.user.id);
		if (logId !== "new" && !log?.id) redirect(302, `/characters/${character.id}`);

		const form = await superValidate(event, valibot(characterLogSchema(character)));
		if (!form.valid) return fail(400, { form });

		const result = await saveLog(form.data, session.user);
		if (result instanceof SaveError) return result.toForm(form);

		redirect(302, `/characters/${character.id}`);
	}
};

import { defaultLogData, getMagicItems, getStoryAwards, logDataToSchema } from "$lib/entities.js";
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

	let log = defaultLogData(session.user.id, character.id);

	if (event.params.logId !== "new") {
		log = await getLog(logId, session.user.id, character.id);
		if (!log.id) error(404, "Log not found");
	}

	if (log.isDmLog) redirect(302, `/dm-logs/${log.id}`);

	const form = await superValidate(logDataToSchema(session.user.id, log, character), valibot(characterLogSchema(character)), {
		errors: event.params.logId !== "new"
	});

	const magicItems = getMagicItems(character, { excludeDropped: true, lastLogId: log.id }).sort((a, b) => sorter(a.name, b.name));
	const storyAwards = getStoryAwards(character, { excludeDropped: true, lastLogId: log.id }).sort((a, b) =>
		sorter(a.name, b.name)
	);

	const dms = await getUserDMs(session.user);

	return {
		...event.params,
		title: event.params.logId === "new" ? `New Log - ${character.name}` : `Edit ${form.data.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: event.params.logId === "new" ? `New Log` : form.data.name,
			href: `/characters/${character.id}/log/${form.data.id}`
		}),
		user: session.user,
		totalLevel: character.total_level,
		magicItems,
		storyAwards,
		dms,
		form
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

		const log = await getLog(logId, session.user.id, character.id);
		if (event.params.logId !== "new" && !log.id) redirect(302, `/characters/${character.id}`);

		const form = await superValidate(event, valibot(characterLogSchema(character)));
		if (!form.valid) return fail(400, { form });

		const result = await saveLog(form.data, session.user);
		if (result instanceof SaveError) return result.toForm(form);

		redirect(302, `/characters/${character.id}`);
	}
};

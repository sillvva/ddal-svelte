import { defaultLogData, logDataToSchema } from "$lib/entities.js";
import { dMLogSchema } from "$lib/schemas";
import { saveLog } from "$server/actions/logs";
import { signInRedirect } from "$server/auth";
import { getCharacterCaches, getCharactersCache } from "$server/data/characters";
import { getDMLog, getLog } from "$server/data/logs";
import { error, fail, redirect } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";

export const load = async (event) => {
	const parent = await event.parent();

	const session = event.locals.session;
	if (!session?.user?.name) signInRedirect(event.url);
	const user = session.user;

	const characters = await getCharactersCache(user.id)
		.then(async (characters) => await getCharacterCaches(characters.map((c) => c.id)))
		.then((characters) =>
			characters.map((c) => ({
				...c,
				logs: c.logs.filter((l) => l.id !== event.params.logId),
				magic_items: [],
				story_awards: [],
				log_levels: []
			}))
		);

	let log = defaultLogData(user.id);
	if (event.params.logId !== "new") {
		log = await getDMLog(event.params.logId, user.id);
		if (!log.id) error(404, "Log not found");
		if (!log.is_dm_log) redirect(302, `/characters/${log.characterId}/log/${log.id}`);
	}

	const character = characters.find((c) => c.id === log.characterId);
	const form = await superValidate(logDataToSchema(session.user.id, log, character), valibot(dMLogSchema(characters)), {
		errors: event.params.logId !== "new"
	});

	return {
		...event.params,
		title: event.params.logId === "new" ? "New DM Log" : `Edit ${form.data.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: event.params.logId === "new" ? "New DM Log" : `${form.data.name}`,
			href: `/dm-logs/${event.params.logId}`
		}),
		characters: characters.map((c) => ({ id: c.id, name: c.name })),
		form
	};
};

export const actions = {
	saveLog: async (event) => {
		const session = event.locals.session;
		if (!session?.user) redirect(302, "/");

		const log = await getLog(event.params.logId || "", session.user.id);
		if (event.params.logId !== "new" && !log.id) redirect(302, `/dm-logs`);

		const characters = await getCharactersCache(session.user.id).then(
			async (characters) => await getCharacterCaches(characters.map((c) => c.id))
		);

		const form = await superValidate(event, valibot(dMLogSchema(characters)));
		if (!form.valid) return fail(400, { form });

		const result = await saveLog(form.data, session.user);
		if ("id" in result) redirect(302, `/dm-logs/`);

		return message(
			form,
			{
				type: "error",
				text: result.error
			},
			{
				status: result.status
			}
		);
	}
};

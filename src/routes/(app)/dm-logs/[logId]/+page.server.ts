import { defaultLogData, logDataToSchema } from "$lib/entities.js";
import { dMLogSchema, logIdSchema } from "$lib/schemas";
import { SaveError } from "$lib/util.js";
import { saveLog } from "$server/actions/logs";
import { assertUser } from "$server/auth";
import { getCharactersWithLogs } from "$server/data/characters";
import { getLog } from "$server/data/logs";
import { error, redirect } from "@sveltejs/kit";
import { fail, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";
import { safeParse } from "valibot";

export const load = async (event) => {
	const session = event.locals.session;
	assertUser(session?.user, event.url);
	const user = session.user;

	const parent = await event.parent();

	const idResult = safeParse(logIdSchema, event.params.logId || "");
	if (!idResult.success) redirect(302, `/dm-logs`);
	const logId = idResult.output;

	const characters = await getCharactersWithLogs(user.id).then((characters) =>
		characters.map((c) => ({
			...c,
			logs: c.logs.filter((l) => l.id !== logId),
			magic_items: [],
			story_awards: [],
			log_levels: []
		}))
	);

	let log = (await getLog(logId, user.id)) || defaultLogData(user.id);
	if (logId !== "new") {
		if (!log.id) error(404, "Log not found");
		if (!log.isDmLog) redirect(302, `/characters/${log.characterId}/log/${log.id}`);
	}

	const form = await superValidate(logDataToSchema(session.user.id, log), valibot(dMLogSchema(characters)), {
		errors: logId !== "new"
	});

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
};

export const actions = {
	saveLog: async (event) => {
		const session = event.locals.session;
		assertUser(session?.user, event.url);

		const idResult = safeParse(logIdSchema, event.params.logId || "");
		if (!idResult.success) redirect(302, `/dm-logs`);
		const logId = idResult.output;

		const log = await getLog(logId, session.user.id);
		if (logId !== "new" && !log?.id) redirect(302, `/dm-logs`);

		const characters = await getCharactersWithLogs(session.user.id);
		const form = await superValidate(event, valibot(dMLogSchema(characters)));
		if (!form.valid) return fail(400, { form });

		const result = await saveLog(form.data, session.user);
		if (result instanceof SaveError) return result.toForm(form);

		redirect(302, `/dm-logs`);
	}
};

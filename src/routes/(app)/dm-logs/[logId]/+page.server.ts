import { dMLogSchema } from "$lib/schemas";
import { saveLog } from "$src/server/actions/logs";
import { signInRedirect } from "$src/server/auth";
import { getCharacterCaches, getCharactersCache } from "$src/server/data/characters";
import { getDMLog, getLog } from "$src/server/data/logs";
import { error, fail, redirect } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";

export const load = async (event) => {
	const parent = await event.parent();

	const session = event.locals.session;
	if (!session?.user?.name) signInRedirect(event.url);
	const user = session.user;

	const log = await getDMLog(event.params.logId, user.id);
	if (event.params.logId !== "new" && !log.id) error(404, "Log not found");
	if (!log.is_dm_log) redirect(302, `/characters/${log.characterId}/log/${log.id}`);

	log.dm = log.dm?.name ? log.dm : { name: session.user.name || "", id: "", DCI: null, uid: user.id, owner: user.id };

	const characters = await getCharactersCache(user.id)
		.then(async (characters) => await getCharacterCaches(characters.map((c) => c.id)))
		.then((characters) => characters.map((c) => ({ ...c, logs: c.logs.filter((l) => l.id !== log.id) })));
	const character = characters.find((c) => c.id === log.characterId);

	const form = await superValidate(valibot(dMLogSchema(characters)), {
		defaults: {
			...log,
			characterId: character?.id || "",
			characterName: character?.name || "",
			magic_items_gained: log.magic_items_gained.map((item) => ({
				id: item.id,
				name: item.name,
				description: item.description || ""
			})),
			magic_items_lost: log.magic_items_lost.map((item) => item.id),
			story_awards_gained: log.story_awards_gained.map((award) => ({
				id: award.id,
				name: award.name,
				description: award.description || ""
			})),
			story_awards_lost: log.story_awards_lost.map((award) => award.id),
			is_dm_log: true
		}
	});

	return {
		...event.params,
		title: event.params.logId === "new" ? "New DM Log" : `Edit ${log.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: event.params.logId === "new" ? "New DM Log" : `${log.name}`,
			href: `/dm-logs/${event.params.logId}`
		}),
		user,
		characters,
		character,
		form
	};
};

export const actions = {
	saveLog: async (event) => {
		const session = event.locals.session;
		if (!session?.user) redirect(302, "/");

		const log = await getLog(event.params.logId || "", session.user.id);
		if (event.params.logId !== "new" && !log.id) redirect(302, `/dm-logs`);

		const characters = await getCharactersCache(session.user.id)
			.then(async (characters) => await getCharacterCaches(characters.map((c) => c.id)))
			.then((characters) => characters.map((c) => ({ ...c, logs: c.logs.filter((l) => l.id !== log.id) })));

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

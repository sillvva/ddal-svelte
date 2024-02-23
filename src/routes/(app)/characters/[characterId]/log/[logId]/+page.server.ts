import { defaultLog, getMagicItems, getStoryAwards } from "$lib/entities.js";
import { characterLogSchema } from "$lib/schemas";
import { sorter } from "$lib/util.js";
import { saveLog } from "$src/server/actions/logs.js";
import { signInRedirect } from "$src/server/auth.js";
import { getCharacterCache } from "$src/server/data/characters";
import { getUserDMsCache } from "$src/server/data/dms";
import { getLog } from "$src/server/data/logs";
import { error, fail, redirect } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms";
import { valibot } from "sveltekit-superforms/adapters";

export const load = async (event) => {
	const parent = await event.parent();
	const character = parent.character;
	if (!character) error(404, "Character not found");

	const session = event.locals.session;
	if (!session?.user) signInRedirect(event.url);

	let log = defaultLog(session.user.id, character.id);
	if (event.params.logId !== "new")
		log = await getLog(event.params.logId, session.user.id, character.id).then((log) => {
			if (!log.id) error(404, "Log not found");
			return log;
		});

	if (log.is_dm_log) redirect(302, `/dm-logs/${log.id}`);

	const dms = await getUserDMsCache(session.user);

	const form = await superValidate(valibot(characterLogSchema(character)), {
		defaults: {
			...log,
			characterId: character.id,
			characterName: character.name,
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
			story_awards_lost: log.story_awards_lost.map((award) => award.id)
		}
	});

	const magicItems = getMagicItems(character, { excludeDropped: true, lastLogId: log.id }).sort((a, b) => sorter(a.name, b.name));
	const storyAwards = getStoryAwards(character, { excludeDropped: true, lastLogId: log.id }).sort((a, b) =>
		sorter(a.name, b.name)
	);

	return {
		...event.params,
		title: event.params.logId === "new" ? `New Log - ${character.name}` : `Edit ${log.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: event.params.logId === "new" ? `New Log` : log.name,
			href: `/characters/${character.id}/log/${log.id}`
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
		const session = await event.locals.session;
		if (!session?.user) redirect(302, "/");

		const character = await getCharacterCache(event.params.characterId || "", false);
		if (!character) redirect(302, "/characters");

		const log = await getLog(event.params.logId, session.user.id, character.id);
		if (event.params.logId !== "new" && !log.id) redirect(302, `/characters/${character.id}`);

		const form = await superValidate(event, valibot(characterLogSchema(character)));
		if (!form.valid) return fail(400, { form });

		const result = await saveLog(form.data, session.user);
		if ("id" in result) redirect(302, `/characters/${character.id}`);

		event.cookies.set("clearCache", "true", { path: "/" });

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

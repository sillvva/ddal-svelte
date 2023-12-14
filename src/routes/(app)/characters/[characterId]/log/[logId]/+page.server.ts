import { parseFormData } from "$src/lib/components/SchemaForm.svelte";
import { defaultLog } from "$src/lib/entities.js";
import { logSchema } from "$src/lib/types/schemas";
import { saveLog } from "$src/server/actions/logs.js";
import { signInRedirect } from "$src/server/auth.js";
import { getCharacterCache } from "$src/server/data/characters";
import { getUserDMsWithLogs } from "$src/server/data/dms";
import { getLog } from "$src/server/data/logs";
import { error, redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();
	const character = parent.character;
	if (!character) throw error(404, "Character not found");

	const session = event.locals.session;
	if (!session?.user) throw signInRedirect(event.url);

	const log =
		event.params.logId !== "new"
			? await getLog(event.params.logId, session.user.id, character.id).then((log) => {
					if (!log.id) error(404, "Log not found");
					return log;
			  })
			: defaultLog(session.user.id, character.id);

	if (log.is_dm_log) redirect(302, `/dm-logs/${log.id}`);

	const dms = await getUserDMsWithLogs(session.user.id);

	return {
		title: event.params.logId === "new" ? `New Log - ${character.name}` : `Edit ${log.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: event.params.logId === "new" ? `New Log` : log.name,
			href: `/characters/${character.id}/log/${log.id}`
		}),
		...event.params,
		log,
		character,
		dms,
		user: session.user
	};
};

export const actions = {
	saveLog: async (event) => {
		const session = await event.locals.session;
		if (!session?.user) throw redirect(302, "/");

		const character = await getCharacterCache(event.params.characterId || "", false);
		if (!character) throw redirect(302, "/characters");

		const log = await getLog(event.params.logId || "", session.user.id, character.id);
		if (event.params.logId !== "new" && !log.id) redirect(302, `/characters/${character.id}`);

		try {
			const formData = await event.request.formData();
			const logData = await parseFormData(formData, logSchema, {
				arrays: ["magic_items_gained", "story_awards_gained", "magic_items_lost", "story_awards_lost"],
				dates: ["date", "applied_date"],
				booleans: ["is_dm_log"],
				numbers: ["season", "level", "gold", "acp", "tcp", "experience", "dtd"]
			});
			const result = await saveLog(logData, session.user);
			if (result && result.id) redirect(302, `/characters/${character.id}`);

			return result;
		} catch (error) {
			if (error instanceof Error) {
				return {
					id: null,
					log: null,
					error: error.message
				};
			}
			throw error;
		}
	}
};

import { parseFormData } from "$src/lib/components/SchemaForm.svelte";
import { logSchema } from "$src/lib/types/schemas.js";
import { saveLog } from "$src/server/actions/logs";
import { signInRedirect } from "$src/server/auth.js";
import { getCharacterCache, getCharactersCache } from "$src/server/data/characters";
import { getDMLog, getLog } from "$src/server/data/logs";
import { error, redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();

	const session = parent.session;
	if (!session?.user?.name) throw signInRedirect(event.url);

	const log = await getDMLog(event.params.logId);
	if (event.params.logId !== "new" && !log.id) throw error(404, "Log not found");

	log.dm = log.dm?.name ? log.dm : { name: session.user.name || "", id: "", DCI: null, uid: session.user.id };

	const characters = await getCharactersCache(session.user.id);
	const character = characters.find((c) => c.id === log.characterId);

	return {
		title: event.params.logId === "new" ? "New DM Log" : `Edit ${log.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: event.params.logId === "new" ? "New DM Log" : `${log.name}`,
			href: `/dm-logs/${event.params.logId}`
		}),
		...event.params,
		characters,
		character,
		log
	};
};

export const actions = {
	saveLog: async (event) => {
		const session = await event.locals.getSession();
		if (!session?.user) throw redirect(301, "/");

		const log = await getLog(event.params.logId || "");
		if (event.params.logId !== "new" && !log.id) throw redirect(301, `/dm-logs`);

		try {
			const formData = await event.request.formData();
			const logData = await parseFormData(formData, logSchema);
			if (!logData.is_dm_log) throw new Error("Only DM logs can be saved here.");

			if (logData.characterId && logData.applied_date) {
				const character = await getCharacterCache(logData.characterId, false);
				if (!character) throw new Error("Character not found");
			} else if (logData.characterId && !logData.applied_date) {
				throw new Error("Applied date is required if character is selected.");
			} else if (!logData.characterId && logData.applied_date) {
				throw new Error("Character is required if applied date is entered.");
			}

			const result = await saveLog(logData, session.user);
			if (result && result.id) throw redirect(301, `/dm-logs/`);

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

import { parseFormData } from "$lib/components/SchemaForm.svelte";
import { dMLogSchema } from "$lib/schemas";
import { saveLog } from "$src/server/actions/logs";
import { signInRedirect } from "$src/server/auth";
import { getCharacterCache, getCharactersCache } from "$src/server/data/characters";
import { getDMLog, getLog } from "$src/server/data/logs";
import { error, redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();

	const session = event.locals.session;
	if (!session?.user?.name) signInRedirect(event.url);

	const log = await getDMLog(event.params.logId, session.user.id);
	if (event.params.logId !== "new" && !log.id) error(404, "Log not found");
	if (!log.is_dm_log) redirect(302, `/characters/${log.characterId}/log/${log.id}`);

	log.dm = log.dm?.name
		? log.dm
		: { name: session.user.name || "", id: "", DCI: null, uid: session.user.id, owner: session.user.id };

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
		log,
		user: session.user
	};
};

export const actions = {
	saveLog: async (event) => {
		const session = event.locals.session;
		if (!session?.user) redirect(302, "/");

		const log = await getLog(event.params.logId || "", session.user.id);
		if (event.params.logId !== "new" && !log.id) redirect(302, `/dm-logs`);

		try {
			const formData = await event.request.formData();
			const characters = await getCharactersCache(session.user.id);
			const logData = await parseFormData(formData, dMLogSchema(characters), {
				arrays: ["magic_items_gained", "story_awards_gained", "magic_items_lost", "story_awards_lost"],
				dates: ["date", "applied_date"],
				booleans: ["is_dm_log"],
				numbers: ["season", "level", "gold", "acp", "tcp", "experience", "dtd"]
			});
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
			if (result && result.id) redirect(302, `/dm-logs/`);

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

import { defaultLog } from "$src/lib/entities.js";
import { logSchema } from "$src/lib/types/schemas";
import { saveLog } from "$src/server/actions/logs";
import { signInRedirect } from "$src/server/auth.js";
import { getCharacterCache } from "$src/server/data/characters";
import { getUserDMs } from "$src/server/data/dms";
import { getLog } from "$src/server/data/logs";
import { error, redirect } from "@sveltejs/kit";

import type { DatesToStrings } from "$src/lib/types/util";
export const load = async (event) => {
	const parent = await event.parent();
	const character = parent.character;
	if (!character) throw error(404, "Character not found");

	const session = parent.session;
	if (!session?.user) throw signInRedirect(event.url);

	const log =
		event.params.logId !== "new"
			? await getLog(event.params.logId, character.id).then((log) => {
					if (!log.id) throw error(404, "Log not found");
					return log;
			  })
			: defaultLog(character.id);

	const dms = await getUserDMs(session.user.id);

	return {
		title: event.params.logId === "new" ? `New Log - ${character.name}` : `Edit ${log.name}`,
		breadcrumbs: parent.breadcrumbs.concat({
			name: event.params.logId === "new" ? `New Log` : log.name,
			href: `/characters/${character.id}/log/${log.id}`
		}),
		...event.params,
		log,
		character,
		dms
	};
};

export const actions = {
	saveLog: async (event) => {
		const session = await event.locals.getSession();
		if (!session?.user) throw redirect(301, "/");

		const character = await getCharacterCache(event.params.characterId || "", false);
		if (!character) throw redirect(301, "/characters");

		const log = await getLog(event.params.logId || "", character.id);
		if (event.params.logId !== "new" && !log.id) throw redirect(301, `/characters/${character.id}`);

		try {
			const formData = await event.request.formData();
			const parsedData = JSON.parse((formData.get("form") as string) || "{}") as DatesToStrings<typeof log>;
			const logData = logSchema.parse(parsedData);

			const result = await saveLog(logData, session.user);
			if (result && result.id) throw redirect(301, `/characters/${character.id}`);

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

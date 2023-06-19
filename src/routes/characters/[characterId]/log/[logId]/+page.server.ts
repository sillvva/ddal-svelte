import { getCharacter } from "$src/server/data/characters";
import { getUserDMs } from "$src/server/data/dms";
import { getLog } from "$src/server/data/logs";
import { redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";
import type { LogType } from "@prisma/client";
export const load = (async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");

	const character = await getCharacter(event.params.characterId, false);
	if (!character) throw redirect(301, "/characters");

	const log = (await getLog(event.params.logId)) || {
		characterId: character.id,
		id: "",
		name: "",
		description: "",
		date: new Date(),
		type: "game" as LogType,
		created_at: new Date(),
		experience: 0,
		acp: 0,
		tcp: 0,
		level: 0,
		gold: 0,
		dtd: 0,
		dungeonMasterId: "",
		dm: {
			id: "",
			name: "",
			DCI: null,
			uid: ""
		},
		applied_date: new Date(),
		is_dm_log: false,
		magic_items_gained: [],
		magic_items_lost: [],
		story_awards_gained: [],
		story_awards_lost: []
	};

	if (event.params.logId !== "new" && !log.id) throw redirect(301, `/characters/${character.id}`);

	const dms = await getUserDMs(session.user.id);

	return {
		log,
		character,
		dms,
		...event.params
	};
}) satisfies PageServerLoad;

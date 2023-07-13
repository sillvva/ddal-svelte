import { getLog } from "$src/server/data/logs";
import { error } from "@sveltejs/kit";

export const load = async (event) => {
	const parent = await event.parent();
  
  const character = parent.character;
	if (!character) throw error(404, "Character not found");
  const log = await getLog(event.params.logId, character.id);
	if (event.params.logId !== "new" && !log.id) throw error(404, "Log not found");

	return {
		breadcrumbs: parent.breadcrumbs.concat(
			{
				name: event.params.logId === "new" ? `New Log` : log.name,
				href: `/characters/${character.id}/log/${log.id}`
			}
		),
    log
	};
};

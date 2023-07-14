import { getDMLog } from "$src/server/data/logs";
import { error, redirect } from "@sveltejs/kit";

export const load = async (event) => {
  const parent = await event.parent();

	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");

	const log = await getDMLog(event.params.logId);
	if (event.params.logId !== "new" && !log.id) throw error(404, "Log not found");

	log.dm = log.dm?.name ? log.dm : { name: session.user.name || "", id: "", DCI: null, uid: session.user.id };

	return {
		log,
    breadcrumbs: parent.breadcrumbs.concat(
      {
        name: event.params.logId === "new" ? "New DM Log" : `${log.name}`,
        href: `/dm-logs/${event.params.logId}`
      }
    ) 
	};
};
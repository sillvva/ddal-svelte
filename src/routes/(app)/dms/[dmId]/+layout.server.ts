import { getUserDMWithLogs } from "$src/server/data/dms";
import { error, redirect } from "@sveltejs/kit";

export const load = async (event) => {
  const parent = await event.parent();

	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");

	const dm = await getUserDMWithLogs(session.user.id, event.params.dmId);
	if (!dm) throw error(404, "DM not found");

	return {
		dm,
    breadcrumbs: parent.breadcrumbs.concat({
      name: dm.name,
      href: `/dms/${dm.id}`
    })
	};
};
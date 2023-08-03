import { parseError } from "$lib/utils";
import { getDMLogsCache } from "$src/server/data/logs";
import { json } from "@sveltejs/kit";

export async function GET({ locals }) {
	const session = await locals.getSession();
	if (!session?.user) return json({ error: "Unauthorized" }, { status: 401 });

	try {
		const dmLogs = await getDMLogsCache(session.user.id, session.user.name || "");

		return json(dmLogs);
	} catch (err) {
		return json({ error: parseError(err) }, { status: 500 });
	}
}

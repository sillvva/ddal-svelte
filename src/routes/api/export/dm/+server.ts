import { parseError } from "$lib/misc";
import { getDMLogs } from "$src/server/data/logs";
import { json } from "@sveltejs/kit";

export async function GET({ locals }) {
	const session = await locals.getSession();
	if (!session?.user) return json({ error: "Unauthorized" }, { status: 401 });

	try {
		const dmLogs = await getDMLogs(session.user.id, session.user.name || "");

		return json(dmLogs);
	} catch (err) {
		return json({ error: parseError(err) }, { status: 500 });
	}
}

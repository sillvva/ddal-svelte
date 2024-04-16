import { parseError } from "$lib/util";
import { rateLimiter } from "$server/cache.js";
import { getDMLogsCache } from "$server/data/logs";
import { json } from "@sveltejs/kit";

export async function GET({ locals }) {
	const session = locals.session;
	if (!session?.user) return json({ error: "Unauthorized" }, { status: 401 });

	const { success } = await rateLimiter("export", session.user.id);
	if (!success) return json({ error: "Too many requests" }, { status: 429 });

	try {
		const dmLogs = await getDMLogsCache(session.user.id);

		return json(dmLogs);
	} catch (err) {
		return json({ error: parseError(err) }, { status: 500 });
	}
}

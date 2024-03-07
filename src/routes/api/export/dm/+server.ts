import { parseError } from "$lib/util";
import { rateLimiter } from "$src/server/cache.js";
import { getDMLogsCache } from "$src/server/data/logs";
import { json } from "@sveltejs/kit";

export async function GET({ locals }) {
	const session = locals.session;
	if (!session?.user) return json({ error: "Unauthorized" }, { status: 401 });

	const { success } = await rateLimiter("fetch", "export", session.user.id);
	if (!success) return json({ error: "Too many requests" }, { status: 429 });

	try {
		const dmLogs = await getDMLogsCache(session.user.id, session.user.name || "");

		return json(dmLogs);
	} catch (err) {
		return json({ error: parseError(err) }, { status: 500 });
	}
}

import { cache } from "$src/server/cache.js";
import { getCharactersWithLogs } from "$src/server/data/characters.js";
import { getUserDMs } from "$src/server/data/dms.js";
import { getUserSearchLogs } from "$src/server/data/logs.js";
import { json } from "@sveltejs/kit";

export type SearchData = Awaited<ReturnType<typeof getData>>;
async function getData(user: NonNullable<LocalsSession["user"]>) {
	return [
		{
			title: "Characters",
			items: await getCharactersWithLogs(user.id, false).then((characters) =>
				characters.map(
					(character) =>
						({
							...character,
							log_levels: [],
							type: "character",
							url: `/characters/${character.id}`
						}) as const
				)
			)
		},
		{
			title: "Logs",
			items: await getUserSearchLogs(user.id).then((logs) =>
				logs.map(
					(log) =>
						({
							...log,
							type: "log",
							url: log.is_dm_log ? `/dm-logs/${log.id}` : `/characters/${log.character?.id}/log/${log.id}`
						}) as const
				)
			)
		},
		{
			title: "DMs",
			items: await getUserDMs(user).then((dms) =>
				dms.map(
					(dm) =>
						({
							...dm,
							type: "dm",
							url: `/dms/${dm.id}`
						}) as const
				)
			)
		}
	];
}

async function getDataCache(user: NonNullable<LocalsSession["user"]>) {
	return await cache(() => getData(user), ["search-data", user.id], 86400 * 7);
}

export async function GET({ locals }) {
	const session = locals.session;
	if (!session?.user?.id) return json({ error: "Unauthorized" }, { status: 401 });

	return json(await getDataCache(session.user));
}

import { cache } from "$src/server/cache.js";
import { getCharactersWithLogs } from "$src/server/data/characters.js";
import { getUserDMs } from "$src/server/data/dms.js";
import { getUserSearchLogs } from "$src/server/data/logs.js";
import { json } from "@sveltejs/kit";

export type SearchData = Awaited<ReturnType<typeof getData>>;
async function getData(user: NonNullable<LocalsSession["user"]>) {
	const characters = await getCharactersWithLogs(user.id, false).then((characters) =>
		characters.map(
			(character) =>
				({
					...character,
					type: "character",
					url: `/characters/${character.id}`
				}) as const
		)
	);

	const dms = await getUserDMs(user).then((dms) =>
		dms.map(
			(dm) =>
				({
					...dm,
					type: "dm",
					url: `/dms/${dm.id}`
				}) as const
		)
	);

	const logs = await getUserSearchLogs(user.id).then((logs) =>
		logs.map(
			(log) =>
				({
					...log,
					type: "log",
					url: log.is_dm_log ? `/dm-logs/${log.id}` : `/characters/${log.character?.id}/log/${log.id}`
				}) as const
		)
	);

	return [
		{
			title: "Characters",
			items: characters
		},
		{
			title: "DMs",
			items: dms
		},
		{
			title: "Logs",
			items: logs
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

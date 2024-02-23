import { getCharacterCaches, getCharactersCache } from "$src/server/data/characters.js";
import { getUserDMsCache } from "$src/server/data/dms.js";
import { getUserSearchLogsCache } from "$src/server/data/logs.js";
import { json } from "@sveltejs/kit";

export type SearchData = Awaited<ReturnType<typeof getData>>;
async function getData(user: NonNullable<LocalsSession["user"]>) {
	const characters = await getCharactersCache(user.id)
		.then((characters) => {
			return getCharacterCaches(characters.map((character) => character.id));
		})
		.then((characters) =>
			characters.map(
				(character) =>
					({
						...character,
						type: "character",
						url: `/characters/${character.id}`
					}) as const
			)
		);

	const dms = await getUserDMsCache(user).then((dms) =>
		dms.map(
			(dm) =>
				({
					...dm,
					type: "dm",
					url: `/dms/${dm.id}`
				}) as const
		)
	);

	const logs = await getUserSearchLogsCache(user.id).then((logs) =>
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

export async function GET({ locals }) {
	const session = locals.session;
	if (!session?.user?.id) return json({ error: "Unauthorized" }, { status: 401 });

	return json(await getData(session.user));
}

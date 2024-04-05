import { searchSections } from "$lib/constants.js";
import { cache } from "$server/cache.js";
import { getCharactersWithLogs } from "$server/data/characters.js";
import { getUserDMs } from "$server/data/dms.js";
import { getUserLogs } from "$server/data/logs.js";
import { json } from "@sveltejs/kit";

type SectionData = typeof sectionData;
const sectionData = {
	title: "Sections",
	items: searchSections.map(
		(section) =>
			({
				type: "section",
				name: section.title,
				url: section.url
			}) as const
	)
};

type GetData = Awaited<ReturnType<typeof getData>>;
export type SearchData = Array<SectionData | GetData[number]>;
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
		},
		{
			title: "Logs",
			items: await getUserLogs(user.id).then((logs) =>
				logs.map(
					(log) =>
						({
							...log,
							type: "log",
							url: log.isDmLog ? `/dm-logs?s=${log.id}` : `/characters/${log.character?.id}?s=${log.id}`
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

	return json(([sectionData] as SearchData).concat(await getDataCache(session.user)));
}

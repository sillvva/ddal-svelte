import { searchSections } from "$lib/constants.js";
import type { LocalsUser } from "$lib/schemas.js";
import { getUserCharacters } from "$server/data/characters.js";
import { getUserDMs } from "$server/data/dms.js";
import { getUserLogs } from "$server/data/logs.js";
import { fetchWithFallback } from "$server/db/effect";
import { sorter } from "@sillvva/utils";
import { json } from "@sveltejs/kit";

type SectionData = typeof sectionData;
const sectionData = {
	title: "Sections" as const,
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
async function getData(user: LocalsUser) {
	return [
		{
			title: "Characters" as const,
			items: await fetchWithFallback(getUserCharacters(user.id, false), () => []).then((characters) =>
				characters
					.map(
						(character) =>
							({
								...character,
								logLevels: [] as {
									id: string;
									levels: number;
								}[],
								type: "character",
								url: `/characters/${character.id}`
							}) as const
					)
					.toSorted((a, b) => sorter(b.lastLog, a.lastLog))
			)
		},
		{
			title: "DMs" as const,
			items: await fetchWithFallback(getUserDMs(user, { includeLogs: true }), () => []).then((dms) =>
				dms
					.map(
						(dm) =>
							({
								...dm,
								type: "dm",
								url: `/dms/${dm.id}`
							}) as const
					)
					.toSorted((a, b) => sorter(a.name, b.name))
			)
		},
		{
			title: "Logs" as const,
			items: await fetchWithFallback(getUserLogs(user.id), () => []).then((logs) =>
				logs
					.map(
						(log) =>
							({
								...log,
								type: "log",
								showDate: log.isDmLog ? log.appliedDate || log.date : log.date,
								url: log.isDmLog ? `/dm-logs?s=${log.id}` : `/characters/${log.character?.id}?s=${log.id}`
							}) as const
					)
					.toSorted((a, b) => sorter(b.showDate, a.showDate))
			)
		}
	];
}

export async function GET({ locals }) {
	const session = locals.session;
	if (!session?.user.id) return json({ error: "Unauthorized" }, { status: 401 });

	return json(([sectionData] as SearchData).concat(await getData(session.user)));
}

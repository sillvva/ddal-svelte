import { searchSections } from "$lib/constants.js";
import type { LocalsUser } from "$lib/schemas.js";
import { run } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters";
import { withDM } from "$lib/server/effect/dms";
import { withLog } from "$lib/server/effect/logs";
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
			items: await run(withCharacter((service) => service.get.userCharacters(user.id, false))).then((characters) =>
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
			items: await run(withDM((service) => service.get.userDMs(user))).then((dms) =>
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
			items: await run(withLog((service) => service.get.userLogs(user.id))).then((logs) =>
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
	const user = locals.user;
	if (!user?.id) return json({ error: "Unauthorized" }, { status: 401 });

	return json(([sectionData] as SearchData).concat(await getData(user)));
}

import { query } from "$app/server";
import { searchSections } from "$lib/constants.js";
import type { UserId } from "$lib/schemas.js";
import { assertAuthOrRedirect } from "$lib/server/auth";
import { AppLog, runOrThrow } from "$lib/server/effect";
import { withCharacter } from "$lib/server/effect/characters";
import { withDM } from "$lib/server/effect/dms";
import { withLog } from "$lib/server/effect/logs";
import { sorter } from "@sillvva/utils";
import { Effect } from "effect";

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

type GetData = Effect.Effect.Success<ReturnType<typeof getData>>;
export type SearchData = Array<SectionData | GetData[number]>;
const getData = Effect.fn("GetData")(function* (userId: UserId) {
	const characters = yield* withCharacter((service) => service.get.userCharacters(userId, { includeLogs: false }));
	const dms = yield* withDM((service) => service.get.userDMs(userId));
	const logs = yield* withLog((service) => service.get.userLogs(userId));

	return [
		{
			title: "Characters" as const,
			items: characters
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
		},
		{
			title: "DMs" as const,
			items: dms
				.map(
					(dm) =>
						({
							...dm,
							type: "dm",
							url: `/dms/${dm.id}`
						}) as const
				)
				.toSorted((a, b) => sorter(a.name, b.name))
		},
		{
			title: "Logs" as const,
			items: logs
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
		}
	];
});

export const getCommandData = query(() =>
	runOrThrow(
		Effect.fn("GetCommandData")(
			function* () {
				const user = yield* assertAuthOrRedirect();
				const data: SearchData = [sectionData];
				const searchData = yield* getData(user.id);
				return data.concat(searchData) as SearchData;
			},
			(effect) =>
				effect.pipe(
					Effect.tapError((e) => AppLog.error(`[GetCommandData] ${e.message}`, { status: e.status, cause: e.cause })),
					Effect.catchAll(() => Effect.succeed([] as SearchData))
				)
		)
	)
);

export const placeholderQuery = query(() => true);

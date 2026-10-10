import { searchSections } from "#lib/constants.js";
import type { LogLevel } from "#lib/entities.ts";
import type { LocalsUser } from "#lib/schemas.js";
import { guardedQuery } from "#lib/server/effect/guarded.js";
import { AppLog } from "#lib/server/effect/logging.js";
import { CharacterService } from "#lib/server/effect/services/characters.js";
import { DMService } from "#lib/server/effect/services/dms.js";
import { LogService } from "#lib/server/effect/services/logs.js";
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

type GetData = Effect.Success<ReturnType<typeof getData>>;
export type SearchData = Array<SectionData | GetData[number]>;
const getData = Effect.fn("GetData")(function* (user: LocalsUser) {
	const Characters = yield* CharacterService;
	const DMs = yield* DMService;
	const Logs = yield* LogService;

	const characters = yield* Characters.get.all(user.id, { includeLogs: false });
	const dms = yield* DMs.get.all(user);
	const logs = yield* Logs.get.all(user.id);

	return [
		{
			title: "Characters" as const,
			items: characters
				.map(
					(character) =>
						({
							...character,
							logLevels: [] as LogLevel[],
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

export const getCommandData = guardedQuery(function* ({ user }) {
	const data: SearchData = [sectionData];
	const searchData = yield* getData(user).pipe(
		Effect.tapError((e) => AppLog.error(`[GetCommandData] ${e.message}`, { status: e.status, cause: e.cause })),
		Effect.catch(() => Effect.succeed([] as SearchData))
	);
	return data.concat(searchData) as SearchData;
});

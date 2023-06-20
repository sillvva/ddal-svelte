import { logSchema } from "$lib/types/zod-schema";
import { saveLog } from "$src/server/actions/logs";
import { getCharacter, getCharacters } from "$src/server/data/characters";
import { getDMLog, getLog } from "$src/server/data/logs";
import { z } from "zod";
import { redirect } from "@sveltejs/kit";

import type { Actions } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
export const load = (async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");

	const log = await getDMLog(event.params.logId);
	if (event.params.logId !== "new" && !log.id) throw redirect(301, `/dm-logs`);

	const characters = await getCharacters(session.user.id);
	const character = characters.find((c) => c.id === log.characterId);

	return {
		log,
		characters,
		character,
		...event.params
	};
}) satisfies PageServerLoad;

export const actions = {
	saveLog: async (event) => {
		const session = await event.locals.getSession();
		if (!session?.user) throw redirect(301, "/");

		const log = await getLog(event.params.logId || "");
		if (event.params.logId !== "new" && !log.id) throw redirect(301, `/dm-logs`);

		try {
			const formData = await event.request.formData();
			const parsedData = JSON.parse((formData.get("log") as string) || "{}") as Omit<
				typeof log,
				"date" | "applied_date" | "created_at"
			> & { date: string; applied_date: string; created_at: string };
			const logData = logSchema.parse({
				...parsedData,
				date: new Date(parsedData.date),
				applied_date: parsedData.applied_date
					? new Date(parsedData.applied_date)
					: log.is_dm_log
					? new Date(log.created_at)
					: null,
				created_at: new Date(parsedData.created_at)
			});

			if (!logData.is_dm_log) throw new Error("Only DM logs can be saved here");

			const character = await getCharacter(logData.characterId, false);
			if (!character) throw new Error("Character not found");

			const result = await saveLog(character.id, log.id, logData, session.user);
			if (result && result.id) throw redirect(301, `/dm-logs`);

			return { id: null, error: result.error || "An unknown error occurred." };
		} catch (error) {
			if (error instanceof z.ZodError) {
				return {
					id: null,
					error: error.errors[0].message
				};
			}
			if (error instanceof Error) {
				return {
					id: null,
					error: error.message
				};
			}
			return {
				id: null,
				error: "An unknown error occurred."
			};
		}
	}
} satisfies Actions;

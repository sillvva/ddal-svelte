import { logSchema } from "$lib/types/zod-schema";
import { saveLog } from "$src/server/actions/logs";
import { getCharacter, getCharacters } from "$src/server/data/characters";
import { getDMLog, getLog } from "$src/server/data/logs";
import { z } from "zod";
import { error, redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");

	const log = await getDMLog(event.params.logId);
	if (event.params.logId !== "new" && !log.id) throw error(404, "Log not found");

	const characters = await getCharacters(session.user.id);
	const character = characters.find((c) => c.id === log.characterId);

	log.dm = log.dm?.name ? log.dm : { name: session.user.name || "", id: "", DCI: null, uid: session.user.id };

	return {
		log,
		characters,
		character,
		...event.params
	};
};

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
				applied_date: parsedData.applied_date ? new Date(parsedData.applied_date) : null
			});

			if (!logData.is_dm_log) throw new Error("Only DM logs can be saved here.");

			if (logData.characterId && logData.applied_date) {
				const character = await getCharacter(logData.characterId, false);
				if (!character) throw new Error("Character not found");
			} else if (logData.characterId && !logData.applied_date) {
				throw new Error("Applied date is required if character is selected.");
			} else if (!logData.characterId && logData.applied_date) {
				throw new Error("Character is required if applied date is entered.");
			}

			const result = await saveLog(logData, session.user);

			return result;
		} catch (error) {
			if (error instanceof z.ZodError) {
				return {
					id: null,
					log: null,
					error: error.errors[0].message
				};
			}
			if (error instanceof Error) {
				return {
					id: null,
					log: null,
					error: error.message
				};
			}
			throw error;
		}
	}
};

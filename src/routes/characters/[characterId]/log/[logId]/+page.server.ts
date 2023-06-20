import { saveLog } from "$src/server/actions/logs";
import { getCharacter } from "$src/server/data/characters";
import { getUserDMs } from "$src/server/data/dms";
import { getLog } from "$src/server/data/logs";
import { logSchema } from "$src/types/zod-schema";
import { z } from "zod";
import { redirect } from "@sveltejs/kit";

import type { Actions } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load = (async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, "/");

	const character = await getCharacter(event.params.characterId, false);
	if (!character) throw redirect(301, "/characters");

	const log = await getLog(event.params.logId, character.id);
	if (event.params.logId !== "new" && !log.id) throw redirect(301, `/characters/${character.id}`);

	const dms = await getUserDMs(session.user.id);

	return {
		log,
		character,
		dms,
		...event.params
	};
}) satisfies PageServerLoad;

export const actions = {
	saveLog: async (event) => {
		const session = await event.locals.getSession();
		if (!session?.user) throw redirect(301, "/");

		const character = await getCharacter(event.params.characterId || "", false);
		if (!character) throw redirect(301, "/characters");

		const log = await getLog(event.params.logId || "", character.id);
		if (event.params.logId !== "new" && !log.id) throw redirect(301, `/characters/${character.id}`);

		try {
			const formData = await event.request.formData();
			const parsedData = JSON.parse((formData.get("log") as string) || "{}") as Omit<
				typeof log,
				"date" | "applied_date" | "created_at"
			> & { date: string; applied_date: string; created_at: string };
			const logData = logSchema.parse({
				...parsedData,
				date: new Date(parsedData.date),
				applied_date: new Date(parsedData.applied_date),
				created_at: new Date(parsedData.created_at)
			});

			const result = await saveLog(character.id, log.id, logData, session.user);
			if (result && result.id) throw redirect(301, `/characters/${character.id}`);

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

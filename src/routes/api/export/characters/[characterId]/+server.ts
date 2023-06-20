import { parseError } from "$lib/misc";
import { getCharacter, getCharacters } from "$src/server/data/characters";
import { json } from "@sveltejs/kit";

import type { RequestEvent } from "./$types";

export async function GET({ params, locals }: RequestEvent) {
	const session = await locals.getSession();
	if (!session?.user) return json({ error: "Unauthorized" }, { status: 401 });

	const { characterId } = params;

	try {
		if (characterId === "all") {
			const characters = await getCharacters(session.user.id);
			return json(characters);
		} else {
			if (typeof characterId !== "string") return json({ error: "Invalid character ID" }, { status: 400 });

			const character = await getCharacter(characterId);

			if (!character) return json({ error: "Character not found" }, { status: 404 });
			if (character.userId !== session.user.id) return json({ error: "Unauthorized" }, { status: 401 });

			return json(character);
		}
	} catch (err) {
		return json({ error: parseError(err) }, { status: 500 });
	}
}

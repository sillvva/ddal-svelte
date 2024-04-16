import { characterIdSchema } from "$lib/schemas.js";
import { parseError } from "$lib/util";
import { rateLimiter } from "$server/cache.js";
import { getCharacterCache, getCharactersCache } from "$server/data/characters";
import { json } from "@sveltejs/kit";
import { parse } from "valibot";

export async function GET({ params, locals }) {
	const session = locals.session;
	if (!session?.user?.id) return json({ error: "Unauthorized" }, { status: 401 });

	const { success } = await rateLimiter("fetch", session.user.id);
	if (!success) return json({ error: "Too many requests" }, { status: 429 });

	const { characterId } = params;

	try {
		if (characterId === "all") {
			const characters = await getCharactersCache(session.user.id);
			return json(characters);
		} else {
			if (typeof characterId !== "string") return json({ error: "Invalid character ID" }, { status: 400 });

			const id = parse(characterIdSchema, characterId);
			const character = await getCharacterCache(id);

			if (!character) return json({ error: "Character not found" }, { status: 404 });
			if (character.userId !== session.user.id) return json({ error: "Unauthorized" }, { status: 401 });

			return json(character);
		}
	} catch (err) {
		return json({ error: parseError(err) }, { status: 500 });
	}
}

import { parseError } from "$lib/util";
import { rateLimiter } from "$src/server/cache.js";
import { getCharacterCache, getCharactersCache } from "$src/server/data/characters";
import { json } from "@sveltejs/kit";

export async function GET({ params, locals }) {
	const session = locals.session;
	if (!session?.user?.id) return json({ error: "Unauthorized" }, { status: 401 });

	const { success } = await rateLimiter("fetch", "export", session.user.id);
	if (!success) return json({ error: "Too many requests" }, { status: 429 });

	const { characterId } = params;

	try {
		if (characterId === "all") {
			const characters = await getCharactersCache(session.user.id);
			return json(characters);
		} else {
			if (typeof characterId !== "string") return json({ error: "Invalid character ID" }, { status: 400 });

			const character = await getCharacterCache(characterId);

			if (!character) return json({ error: "Character not found" }, { status: 404 });
			if (character.userId !== session.user.id) return json({ error: "Unauthorized" }, { status: 401 });

			return json(character);
		}
	} catch (err) {
		return json({ error: parseError(err) }, { status: 500 });
	}
}

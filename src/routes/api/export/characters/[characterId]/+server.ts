import { parseError } from "$lib/utils";
import { getCharacterCache, getCharactersCache } from "$src/server/data/characters";
import { json } from "@sveltejs/kit";

export async function GET({ params, locals }) {
	const session = await locals.getSession();
	if (!session?.user) return json({ error: "Unauthorized" }, { status: 401 });

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

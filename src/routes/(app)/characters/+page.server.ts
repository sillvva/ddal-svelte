import { clearUserCache, unlinkProvider, type ProviderId } from "$server/actions/users.js";
import { signInRedirect } from "$server/auth";
import { rateLimiter } from "$server/cache.js";
import { getCharacterCaches, getCharactersCache, type CharacterData } from "$server/data/characters";
import { error, redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const session = event.locals.session;
	if (!session?.user) signInRedirect(event.url);

	const { success } = await rateLimiter("fetch", "characters", session.user.id);
	if (!success) error(429, "Too Many Requests");

	const characters = await getCharactersCache(session.user.id).then(async (characters) => {
		const charData: CharacterData[] = [];
		const caches = await getCharacterCaches(characters.map((c) => c.id));
		for (const data of caches) {
			if (data) charData.push(data);
		}
		return charData;
	});

	return {
		title: `${session.user.name}'s Characters`,
		characters
	};
};

export const actions = {
	clearCaches: async (event) => {
		const session = event.locals.session;
		if (!session?.user) redirect(302, "/");
		return await clearUserCache(session.user.id);
	},
	unlinkProvider: async (event) => {
		const session = event.locals.session;
		if (!session?.user) redirect(302, "/");

		try {
			const formData = await event.request.formData();
			const provider = formData.get("provider") as ProviderId;
			if (!provider) throw new Error("No provider specified");

			await unlinkProvider(session.user.id, provider);

			const newSession = await event.locals.auth();
			if (!newSession?.user) redirect(302, "/");

			return { success: true };
		} catch (e) {
			if (e instanceof Error) return { success: false, error: e.message };
			else {
				console.error(e);
				return { success: false, error: "Unknown error" };
			}
		}
	}
};

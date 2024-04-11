import { isDefined } from "$lib/util.js";
import { clearUserCache, unlinkProvider, type ProviderId } from "$server/actions/users.js";
import { assertUser } from "$server/auth";
import { rateLimiter } from "$server/cache.js";
import { getCharacterCaches, getCharactersCache } from "$server/data/characters";
import { error } from "@sveltejs/kit";

export const load = async (event) => {
	const session = event.locals.session;
	assertUser(session?.user, event.url);

	const { success } = await rateLimiter("fetch", session.user.id);
	if (!success) error(429, "Too Many Requests");

	const characters = await getCharactersCache(session.user.id).then(
		async (characters) => await getCharacterCaches(characters.map((c) => c.id)).then((caches) => caches.filter(isDefined))
	);

	return {
		title: `${session.user.name}'s Characters`,
		characters
	};
};

export const actions = {
	clearCaches: async (event) => {
		const session = event.locals.session;
		assertUser(session?.user, event.url);
		return await clearUserCache(session.user.id);
	},
	unlinkProvider: async (event) => {
		const session = event.locals.session;
		assertUser(session?.user, event.url);

		try {
			const formData = await event.request.formData();
			const provider = formData.get("provider") as ProviderId;
			if (!provider) throw new Error("No provider specified");

			await unlinkProvider(session.user.id, provider);

			const newSession = await event.locals.auth();
			assertUser(newSession?.user, event.url);

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

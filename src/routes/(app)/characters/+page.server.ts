import { clearUserCache, unlinkProvider, type ProviderId } from "$src/server/actions/users.js";
import { signInRedirect } from "$src/server/auth";
import { getCharacterCaches, getCharactersCache, type CharacterData } from "$src/server/data/characters";
import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const session = event.locals.session;
	if (!session?.user) signInRedirect(event.url);

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
		event.cookies.set("clearCache", "true", { path: "/" });
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

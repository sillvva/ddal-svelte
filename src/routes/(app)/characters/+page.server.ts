import type { ProviderId } from "$lib/constants.js";
import { unlinkProvider } from "$server/actions/users.js";
import { assertUser } from "$server/auth";
import { getUserCharacters } from "$server/data/characters";
import { fetchWithFallback, withDB } from "$server/db/effect";
import { Effect } from "effect";

export const load = async (event) => {
	const session = event.locals.session;
	assertUser(session?.user, event.url);

	const characters = await fetchWithFallback(getUserCharacters(session.user.id, true), () => []);

	return {
		title: `${session.user.name}'s Characters`,
		characters
	};
};

export const actions = {
	unlinkProvider: async (event) => {
		const session = event.locals.session;
		assertUser(session?.user, event.url);

		try {
			const formData = await event.request.formData();
			const provider = formData.get("provider") as ProviderId;
			if (!provider) throw new Error("No provider specified");

			if (event.cookies.get("provider") === provider) throw new Error("Cannot unlink the provider currently in use");

			const result = await Effect.runPromise(withDB(unlinkProvider(session.user.id, provider)));
			if (!result) throw new Error("Could not unlink provider");

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

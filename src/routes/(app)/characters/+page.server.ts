import type { ProviderId } from "$lib/constants.js";
import { unlinkProvider } from "$server/actions/users.js";
import { assertUser } from "$server/auth";
import { getCharactersWithLogs } from "$server/data/characters";

export const load = async (event) => {
	const session = event.locals.session;
	assertUser(session?.user, event.url);

	const characters = await getCharactersWithLogs(session.user.id);

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

			await unlinkProvider(session.user.id, provider);

			if (event.cookies.get("provider") === provider) {
				event.cookies.delete("provider", { path: "/" });
			}

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

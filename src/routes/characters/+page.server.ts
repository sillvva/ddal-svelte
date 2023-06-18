import { getCharacters } from '$src/server/data/characters';
import { redirect } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load = (async (event) => {
	const session = await event.locals.getSession();
	if (!session?.user) throw redirect(301, '/');
	const characters = await getCharacters(session.user.id);
	return {
		characters
	};
}) satisfies PageServerLoad;

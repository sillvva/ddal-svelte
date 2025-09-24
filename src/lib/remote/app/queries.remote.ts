import { getRequestEvent, query } from "$app/server";
import { getHomeError } from "$lib/server/effect/services/auth";
import { redirect } from "@sveltejs/kit";

export const request = query(() => {
	const {
		locals: { user, session, app, isMobile, isMac }
	} = getRequestEvent();
	return { user, session, app, isMobile, isMac };
});

export const home = query(() => {
	const event = getRequestEvent();
	const user = event.locals.user;

	const redirectTo = event.url.searchParams.get("redirect");
	if (user?.id) redirect(302, redirectTo || "/characters");

	const error = getHomeError();

	return {
		redirectTo,
		error
	};
});

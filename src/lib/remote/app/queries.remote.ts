import { getRequestEvent, query } from "$app/server";

export const request = query(() => {
	const {
		locals: { user, session, app, isMobile, isMac }
	} = getRequestEvent();
	return { user, session, app, isMobile, isMac };
});

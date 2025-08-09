import { getRequestEvent, query } from "$app/server";

export const getRequestDetails = query(() => {
	const event = getRequestEvent();
	return { ...event.locals };
});

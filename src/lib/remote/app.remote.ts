import { getRequestEvent, query } from "$app/server";
import { runOrThrow } from "$lib/server/effect";

export const getRequestDetails = query(() =>
	runOrThrow(function* () {
		const event = getRequestEvent();
		return { ...event.locals };
	})
);

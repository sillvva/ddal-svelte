export * as admin from "./admin";
export * as app from "./app";
export * as auth from "./auth";
export * as characters from "./characters";
export * as command from "./command";
export * as dms from "./dms";
export * as logs from "./logs";

import * as app from "./app";

export async function getRequest() {
	const result = await app.queries.request();
	return {
		...result,
		refresh: () => app.queries.request().refresh()
	};
}

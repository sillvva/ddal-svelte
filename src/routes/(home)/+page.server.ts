import { authErrors, type ErrorCodes } from "$server/auth.js";
import { redirect } from "@sveltejs/kit";

export const load = async (event) => {
	const session = event.locals.session;

	const redirectTo = event.url.searchParams.get("redirect");
	if (session?.user?.id) redirect(302, redirectTo || "/characters");

	let code = event.url.searchParams.get("error") as ErrorCodes | null | "undefined";
	if (code === "undefined") code = "UnknownError";

	return {
		redirectTo,
		code: code && code?.replace(/([a-z])([A-Z])/g, "$1 $2"),
		message: code && authErrors(code, event.url.searchParams.get("detail"))
	};
};

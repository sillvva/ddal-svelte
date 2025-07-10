import { dev } from "$app/environment";
import { getRequestEvent } from "$app/server";
import { localsUserSchema, type LocalsUser } from "$lib/schemas";
import { redirect } from "@sveltejs/kit";
import * as v from "valibot";

export function assertUser(user: LocalsUser | undefined): asserts user is LocalsUser {
	const url = getRequestEvent().url;
	const result = v.safeParse(localsUserSchema, user);
	if (!result.success) {
		if (dev) console.error("assertUser", v.summarize(result.issues));
		redirect(302, `/?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
	}
}

import { getRequestEvent } from "$app/server";
import { localsUserSchema, type LocalsUser } from "$lib/schemas";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";
import { Log } from "./effect";

export function assertUser(user: LocalsUser | undefined): asserts user is LocalsUser {
	const url = getRequestEvent().url;
	const result = v.safeParse(localsUserSchema, user);
	if (!result.success) {
		Effect.runFork(Log.debug("assertUser", { issues: v.summarize(result.issues) }));
		redirect(302, `/?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
	}
}

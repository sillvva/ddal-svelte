import { getRequestEvent } from "$app/server";
import { localsUserSchema, type LocalsUser } from "$lib/schemas";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";
import { Log } from "./effect";

export function assertUser(user: LocalsUser | undefined): asserts user is LocalsUser {
	const event = getRequestEvent();
	const url = event.url;
	const result = v.safeParse(localsUserSchema, user);
	if (!result.success) {
		Effect.runFork(Log.debug("assertUser", { issues: v.summarize(result.issues) }));
		redirect(302, `/?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
	}
	if (result.output.banned) {
		event.cookies
			.getAll()
			.filter((c) => c.name.includes("auth"))
			.forEach((c) => event.cookies.delete(c.name, { path: "/" }));
		redirect(302, `/?code=BANNED&reason=${result.output.banReason}`);
	}
}

export function getError(code: string | null, reason: string | null) {
	switch (code) {
		case "BANNED":
			return { message: `You have been banned from the application.${reason ? ` Reason: ${reason}` : ""}`, code };
	}
	return null;
}

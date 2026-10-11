import { privateEnv } from "#lib/env/private.js";
import { getHomeError } from "#lib/server/effect/services/auth.js";
import { getRequestEvent, query } from "$app/server";
import { redirect } from "@sveltejs/kit";
import * as v from "valibot";

// eslint-disable-next-line custom/enforce-guarded-functions
export const request = query(() => {
	const {
		locals: { user, session, app, isMobile, isMac }
	} = getRequestEvent();
	return { user, session, app, isMobile, isMac };
});

function appPath(value: string | null) {
	if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
	return value;
}

// eslint-disable-next-line custom/enforce-guarded-functions
export const home = query(
	v.object({
		redirect: v.nullable(v.string()),
		error: v.nullable(v.string()),
		errorDescription: v.nullable(v.string())
	}),
	({ redirect: redirectTo, error, errorDescription }) => {
		const { locals } = getRequestEvent();
		const destination = appPath(redirectTo);

		if (locals.user?.id) {
			if (!locals.user.onboarded) redirect(302, "/onboarding");
			redirect(302, destination ?? "/characters");
		}

		return {
			redirectTo: destination,
			error: getHomeError(error, errorDescription),
			signupsEnabled: !privateEnv.DISABLE_SIGNUPS
		};
	}
);

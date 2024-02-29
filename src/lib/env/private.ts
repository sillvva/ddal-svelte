import * as env from "$env/static/private";
import { boolean, minLength, object, optional, parse, regex, string, undefined_, url, value } from "valibot";

export function checkPrivateEnv() {
	if (!env) throw new Error("No environment variables found");

	const envSchemaPrivate = object({
		DATABASE_URL: string([url()]),
		REDIS_URL: string([regex(/^rediss?:\/\//, "Must be a valid Redis URL")]),
		AUTH_SECRET: string([minLength(10, "Must be a string of at least 10 characters")]),
		AUTH_URL: string([url()]),
		AUTH_TRUST_HOST: env["AUTH_URL"]?.includes("localhost")
			? string([value("true", "Required. Must be 'true'")])
			: undefined_("For localhost only"),
		GOOGLE_CLIENT_ID: string([minLength(1, "Required")]),
		GOOGLE_CLIENT_SECRET: string([minLength(1, "Required")]),
		DISCORD_CLIENT_ID: string([minLength(1, "Required")]),
		DISCORD_CLIENT_SECRET: string([minLength(1, "Required")]),
		CRON_CHARACTER_ID: string([minLength(1, "Required")]),
		DISABLE_SIGNUPS: optional(boolean(), false)
	});

	return parse(envSchemaPrivate, {
		...env,
		AUTH_TRUST_HOST: env.AUTH_URL?.includes("localhost") ? env.AUTH_TRUST_HOST : undefined
	});
}

export const privateEnv = checkPrivateEnv();

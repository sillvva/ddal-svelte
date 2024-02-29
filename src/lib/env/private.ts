import * as env from "$env/static/private";
import { boolean, minLength, object, optional, parse, regex, string, transform, url } from "valibot";

export function checkPrivateEnv() {
	if (!env) throw new Error("No environment variables found");

	const envSchemaPrivate = transform(
		object({
			DATABASE_URL: string([url()]),
			REDIS_URL: string([regex(/^rediss?:\/\//, "Must be a valid Redis URL")]),
			AUTH_SECRET: string([minLength(10, "Must be a string of at least 10 characters")]),
			AUTH_URL: string([url()]),
			GOOGLE_CLIENT_ID: string([minLength(1, "Required")]),
			GOOGLE_CLIENT_SECRET: string([minLength(1, "Required")]),
			DISCORD_CLIENT_ID: string([minLength(1, "Required")]),
			DISCORD_CLIENT_SECRET: string([minLength(1, "Required")]),
			CRON_CHARACTER_ID: string([minLength(1, "Required")]),
			DISABLE_SIGNUPS: optional(boolean(), false)
		}),
		(input) => {
			return {
				...input,
				AUTH_TRUST_HOST: input.AUTH_URL.includes("localhost") || undefined
			};
		}
	);

	return parse(envSchemaPrivate, env);
}

export const privateEnv = checkPrivateEnv();

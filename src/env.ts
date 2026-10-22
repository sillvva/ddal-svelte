import { defineEnvVars } from "@sveltejs/kit/env";
import * as v from "valibot";

const requiredString = v.pipe(v.string(), v.trim(), v.regex(/^.*(\p{L}|\p{N})+.*$/u, "Required"));
const url = v.pipe(v.string(), v.trim(), v.url());
const optionalUrl = v.pipe(
	v.optional(v.string(), ""),
	v.transform((value) => (value === "" ? undefined : value)),
	v.optional(url)
);
const hostname = v.pipe(
	v.string(),
	v.trim(),
	v.regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/, "Invalid hostname")
);
const optionalHostname = v.pipe(
	v.optional(v.string(), ""),
	v.transform((value) => (value === "" ? undefined : value)),
	v.optional(hostname)
);

export const variables = defineEnvVars({
	PUBLIC_URL: {
		public: true,
		description: "Public origin of the app, used as the auth base URL",
		schema: url
	},
	PUBLIC_COOLIFY_URL: {
		public: true,
		description: "Application URL injected by Coolify (full URL with protocol, e.g. https://example.com)",
		schema: optionalUrl
	},
	PUBLIC_COOLIFY_FQDN: {
		public: true,
		description: "Application hostname injected by Coolify (bare hostname, e.g. example.com)",
		schema: optionalHostname
	},
	DATABASE_URL: {
		description: "Postgres connection string",
		schema: url
	},
	AUTH_SECRET: {
		description: "Secret used to sign auth tokens",
		schema: v.pipe(v.string(), v.trim(), v.minLength(10))
	},
	GOOGLE_CLIENT_ID: {
		schema: requiredString
	},
	GOOGLE_CLIENT_SECRET: {
		schema: requiredString
	},
	DISCORD_CLIENT_ID: {
		schema: requiredString
	},
	DISCORD_CLIENT_SECRET: {
		schema: requiredString
	},
	DISABLE_SIGNUPS: {
		description: "When true, social sign-up is disabled",
		schema: v.pipe(
			v.optional(v.string(), ""),
			v.transform((value) => value === "true" || value === "1")
		)
	},
	LOG_LEVEL: {
		description: "Server log level: none, debug, info, or error",
		schema: v.pipe(
			v.optional(v.picklist(["none", "debug", "info", "error"]), "error"),
			v.transform((level) =>
				level === "debug"
					? ("Debug" as const)
					: level === "info"
						? ("Info" as const)
						: level === "error"
							? ("Error" as const)
							: ("None" as const)
			)
		)
	}
});

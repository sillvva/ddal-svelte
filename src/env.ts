import { defineEnvVars } from "@sveltejs/kit/env";
import * as v from "valibot";

const requiredString = v.pipe(v.string(), v.trim(), v.regex(/^.*(\p{L}|\p{N})+.*$/u, "Required"));
const url = v.pipe(v.string(), v.trim(), v.url());

// Coolify swaps URL and FQDN values in preview deployments (https://github.com/coollabsio/coolify/issues/4719)
// These schemas normalize both forms
const optionalCoolifyUrl = v.pipe(
	v.optional(v.string(), ""),
	v.transform((value) => {
		if (!value || value === "") return undefined;
		// Handle comma-separated domains (take first)
		const first = value.split(",")[0]?.trim();
		if (!first) return undefined;
		// If no scheme, prepend https://
		const normalized = first.includes("://") ? first : `https://${first}`;
		return normalized;
	}),
	v.optional(url)
);

const optionalCoolifyFqdn = v.pipe(
	v.optional(v.string(), ""),
	v.transform((value) => {
		if (!value || value === "") return undefined;
		// Handle comma-separated domains (take first)
		const first = value.split(",")[0]?.trim();
		if (!first) return undefined;
		// Strip scheme and path to get bare hostname
		let hostname = first.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\/$/, "");
		// Remove port if present for validation
		hostname = hostname.split(":")[0] || hostname;
		return hostname;
	}),
	v.optional(
		v.pipe(
			v.string(),
			v.regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/, "Invalid hostname")
		)
	)
);

export const variables = defineEnvVars({
	PUBLIC_URL: {
		public: true,
		description: "Public origin of the app, used as the auth base URL",
		schema: url
	},
	PUBLIC_COOLIFY_URL: {
		public: true,
		description: "Application URL injected by Coolify (accepts bare host or URL, normalized to https://)",
		schema: optionalCoolifyUrl
	},
	PUBLIC_COOLIFY_FQDN: {
		public: true,
		description: "Application hostname injected by Coolify (accepts host or URL, normalized to bare hostname)",
		schema: optionalCoolifyFqdn
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

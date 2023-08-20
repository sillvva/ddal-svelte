import { equal, minLength, object, startsWith, string, undefinedType, url, ValiError } from "valibot";

export const checkEnv = async () => {
	try {
		const env = await import("$env/static/private");

		const envSchema = object({
			DATABASE_URL: string([url()]),
			REDIS_URL: string([startsWith("redis://")]),
			AUTH_SECRET: string([minLength(10, "Must be a string of at least 10 characters")]),
			AUTH_URL: string([url()]),
			AUTH_TRUST_HOST: env["AUTH_URL"]?.includes("localhost")
				? string([equal("true", "Required. Must be 'true'")])
				: undefinedType("For localhost only"),
			GOOGLE_CLIENT_ID: string([minLength(1, "Required")]),
			GOOGLE_CLIENT_SECRET: string([minLength(1, "Required")]),
			CRON_CHARACTER_ID: string([minLength(1, "Required")])
		});

		return envSchema.parse({
			...env,
			AUTH_TRUST_HOST: env["AUTH_URL"]?.includes("localhost") ? env["AUTH_TRUST_HOST"] : undefined
		});
	} catch (err) {
		if (err instanceof ValiError) {
			console.error(
				"❌ Invalid environment variables:\n",
				...err.issues
					.map((issue) => {
						const path = issue.path?.map((p) => p.key).join(".");
						if (path) return `${path}: ${issue.message}: ${issue.input}\n`;
					})
					.filter(Boolean)
			);
			process.exit(1);
		}
	}
};

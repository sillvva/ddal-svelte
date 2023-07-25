import {
	AUTH_SECRET,
	AUTH_TRUST_HOST,
	AUTH_URL,
	CRON_CHARACTER_ID,
	DATABASE_URL,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET
} from "$env/static/private";
import { equal, minLength, nullish, object, string, url, ValiError } from "valibot";

const envSchema = object({
	DATABASE_URL: string([url()]),
	AUTH_SECRET: string([minLength(10)]),
	AUTH_URL: string([url()]),
	AUTH_TRUST_HOST: nullish(string([equal("true")])),
	GOOGLE_CLIENT_ID: string([minLength(1)]),
	GOOGLE_CLIENT_SECRET: string([minLength(1)]),
	CRON_CHARACTER_ID: string([minLength(1)])
});

export const checkEnv = () => {
	try {
		return envSchema.parse({
			DATABASE_URL: DATABASE_URL,
			AUTH_SECRET: AUTH_SECRET,
			AUTH_URL: AUTH_URL,
			AUTH_TRUST_HOST: AUTH_TRUST_HOST,
			GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET,
			CRON_CHARACTER_ID: CRON_CHARACTER_ID
		});
	} catch (err) {
		if (err instanceof ValiError) {
			const formatErrors = (error: ValiError) =>
				error.issues
					.map((issue) => {
						const path = issue.path?.map((p) => p.key).join(".");
						if (path) return `${path}: ${issue.message}: ${issue.input}\n`;
					})
					.filter(Boolean);
			console.error("❌ Invalid environment variables:\n", ...formatErrors(err));
			process.exit(1);
		}
	}
};

import { parse, ValiError } from "valibot";
import { envSchema } from "./schemas";

export const checkEnv = async () => {
	try {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { default: def, ...env } = await import("$env/static/private");
		if (!env) throw new Error("No environment variables found");

		return parse(envSchema(env), {
			...env,
			AUTH_TRUST_HOST: env.AUTH_URL?.includes("localhost") ? env.AUTH_TRUST_HOST : undefined
		});
	} catch (err) {
		if (err instanceof Error) console.error("❌ Invalid environment variables:\n", err.message);
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

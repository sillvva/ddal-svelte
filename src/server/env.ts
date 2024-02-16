import { envSchema } from "$src/lib/schemas";
import { ValiError, parse } from "valibot";

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
		let message = err;
		if (err instanceof Error) message = err.message;
		else if (err instanceof ValiError) {
			message = err.issues
				.map((issue) => {
					const path = issue.path?.map((p) => p.key).join(".");
					if (path) return `${path}: ${issue.message}: ${issue.input}`;
					return `${issue.message}: ${issue.input}`;
				})
				.join("\n");
		}
		console.error("❌ Invalid environment variables:\n", message);
		process.exit(1);
	}
};

import { envSchemaPrivate, envSchemaPublic } from "$lib/schemas";
import { ValiError, parse } from "valibot";

export const checkEnv = async () => {
	try {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { default: dpriv, ...priv } = await import("$env/static/private");
		if (!priv) throw new Error("No environment variables found");

		const privateResult = parse(envSchemaPrivate(priv), {
			...priv,
			AUTH_TRUST_HOST: priv.AUTH_URL?.includes("localhost") ? priv.AUTH_TRUST_HOST : undefined
		});

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { default: dpub, ...pub } = await import("$env/static/public");
		if (!pub) throw new Error("No environment variables found");

		const publicResult = parse(envSchemaPublic, pub);

		return {
			...privateResult,
			...publicResult
		};
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

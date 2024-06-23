import type { EnvPrivate, envPrivateSchema, EnvPublic } from "$lib/schemas";
import { getDotPath, ValiError, type Prettify } from "valibot";

export function checkEnv<TChecker extends () => EnvPrivate | EnvPublic | Prettify<EnvPrivate & EnvPublic>>(checker: TChecker) {
	try {
		return checker() as ReturnType<TChecker>;
	} catch (err) {
		let message = String(err);
		if (err instanceof ValiError) {
			message = (err as ValiError<typeof envPrivateSchema>).issues
				.map((issue) => {
					const path = getDotPath(issue);
					if (path) return `${path}\n${issue.message}\nValue: ${issue.input}`;
					return `${issue.message}\nValue: ${issue.input}`;
				})
				.join("\n\n");
		}
		else if (err instanceof Error) message = err.message;
		message = `❌ Invalid environment variables:\n\n${message}\n`;
		throw new Error(message);
	}
};
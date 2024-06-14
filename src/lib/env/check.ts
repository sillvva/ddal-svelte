import type { envPrivateSchema } from "$lib/schemas";
import { getDotPath, ValiError } from "valibot";
import { checkPrivateEnv } from "./private";

export const checkEnv = () => {
	try {
		return checkPrivateEnv();
	} catch (err) {
		let message = String(err);
		if (err instanceof Error) message = err.message;
		else if (err instanceof ValiError) {
			message = (err as ValiError<typeof envPrivateSchema>).issues
				.map((issue) => {
					const path = getDotPath(issue);
					if (path) return `${path}: ${issue.message}: ${issue.input}`;
					return `${issue.message}: ${issue.input}`;
				})
				.join("\n");
		}
		console.error("❌ Invalid environment variables:");
		throw new Error(message);
	}
};

export const env = checkEnv();

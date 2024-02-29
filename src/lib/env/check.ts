import { ValiError } from "valibot";
import { checkPrivateEnv } from "./private";
import { checkPublicEnv } from "./public";

export const checkEnv = () => {
	try {
		return {
			...checkPrivateEnv(),
			...checkPublicEnv()
		};
	} catch (err) {
		let message = String(err);
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
		console.error("❌ Invalid environment variables:");
		throw new Error(message);
	}
};

export const env = checkEnv();

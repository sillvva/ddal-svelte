import type { Env, EnvPrivate, EnvPublic } from "$lib/schemas";
import { summarize, ValiError } from "valibot";

export function checkEnv<TChecker extends () => EnvPrivate | EnvPublic | Env>(checker: TChecker) {
	try {
		return checker() as ReturnType<TChecker>;
	} catch (err) {
		let message = String(err);
		if (err instanceof ValiError) {
			message = summarize(err.issues);
		} else if (err instanceof Error) {
			message = err.message;
		}
		throw new Error(`❌ Invalid environment variables:\n\n${message}\n`, { cause: err });
	}
}

import * as env from "$env/static/private";
import { envPrivateSchema, type Env } from "$lib/schemas";
import { parse } from "valibot";
import { checkEnv } from "./check";
import { checkPublicEnv } from "./public";

export function checkPrivateEnv(): Env {
	if (!env) throw new Error("No environment variables found");
	return {
		...parse(envPrivateSchema, env),
		...checkPublicEnv()
	};
}

export const privateEnv = checkEnv(checkPrivateEnv);

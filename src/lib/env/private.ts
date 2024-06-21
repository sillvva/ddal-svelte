import * as env from "$env/static/private";
import { envPrivateSchema, type EnvPrivate, type EnvPublic } from "$lib/schemas";
import { parse, type Prettify } from "valibot";
import { checkEnv } from "./check";
import { checkPublicEnv } from "./public";

export function checkPrivateEnv(): Prettify<EnvPrivate & EnvPublic> {
	if (!env) throw new Error("No environment variables found");
	return {
		...parse(envPrivateSchema, env),
		...checkPublicEnv()
	};
}

export const privateEnv = checkEnv(checkPrivateEnv);
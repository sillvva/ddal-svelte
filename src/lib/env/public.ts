import * as env from "$env/static/public";
import { envPublicSchema } from "$lib/schemas";
import { parse } from "valibot";
import { checkEnv } from "./check";

export function checkPublicEnv() {
	if (!env) throw new Error("No environment variables found");

	return parse(envPublicSchema, env);
}

export const publicEnv = checkEnv(checkPublicEnv);

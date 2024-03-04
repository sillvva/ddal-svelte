import * as env from "$env/static/private";
import { envPrivateSchema } from "$lib/schemas";
import { parse } from "valibot";
import { publicEnv } from "./public";

export function checkPrivateEnv() {
	if (!env) throw new Error("No environment variables found");
	return {
		...parse(envPrivateSchema, env),
		...publicEnv
	};
}

export const privateEnv = checkPrivateEnv();

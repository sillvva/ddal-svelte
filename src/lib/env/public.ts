import * as env from "$env/static/public";
import { object, parse, string, url } from "valibot";

export const envSchemaPublic = object({
	PUBLIC_URL: string([url()])
});

export function checkPublicEnv() {
	if (!env) throw new Error("No environment variables found");

	return parse(envSchemaPublic, env);
}

export const publicEnv = checkPublicEnv();

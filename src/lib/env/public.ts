import * as env from "$env/static/public";
import { object, parse, string, url } from "valibot";

export function checkPublicEnv() {
	if (!env) throw new Error("No environment variables found");

	const envSchemaPublic = object({
		PUBLIC_URL: string([url()])
	});

	return parse(envSchemaPublic, env);
}

export const publicEnv = checkPublicEnv();

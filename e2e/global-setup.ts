import { globalCleanup } from "./cleanup-users.ts";
import { assertAppEnvMatches, localBaseURL } from "./env.ts";

export default async function globalSetup() {
	await assertAppEnvMatches(localBaseURL(), process.env);
	await globalCleanup();
}

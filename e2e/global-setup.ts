import { cleanupLeftoverE2EUsers } from "./cleanup-users.ts";
import { assertLocalE2E, loadLocalEnv } from "./env.ts";
import { resetState } from "./state.ts";

export default async function globalSetup() {
	loadLocalEnv();
	assertLocalE2E(process.env);
	const result = await cleanupLeftoverE2EUsers();
	if (result.users || result.objects) {
		console.log(`Cleared ${result.users} leftover e2e user(s) and ${result.objects} stored image(s) before the run.`);
	}
	resetState();
}

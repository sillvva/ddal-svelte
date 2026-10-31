import { cleanupLeftoverE2EUsers } from "./cleanup-users.ts";
import { assertLocalE2E, loadLocalEnv } from "./env.ts";

loadLocalEnv();
assertLocalE2E(process.env);

const result = await cleanupLeftoverE2EUsers();
console.log(`Removed ${result.users} leftover e2e user(s) and ${result.objects} stored image(s).`);

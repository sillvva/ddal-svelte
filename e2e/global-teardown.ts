import { globalCleanup } from "./cleanup-users.ts";

export default async function globalTeardown() {
	await globalCleanup();
}

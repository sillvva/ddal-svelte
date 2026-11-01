import { globalCleanup } from "./cleanup-users.ts";

export default async function globalSetup() {
	await globalCleanup();
}

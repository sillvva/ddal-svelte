import { env } from "$env/dynamic/public";
import type { Passkey } from "$server/db/schema";
import type { UpdateUserInput } from "$src/routes/(api)/updateUser/+server";
import { adminClient, passkeyClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/svelte";
import { BLANK_CHARACTER, type ProviderId } from "./constants";
import type { UserId } from "./schemas";

export const authClient = createAuthClient({
	baseURL: env.PUBLIC_URL,
	plugins: [passkeyClient(), adminClient()]
});

export function authName(passkey: Passkey) {
	return passkey.name || passkey.id.replace(/[^a-z0-9]/gi, "").slice(-8);
}

export async function setDefaultUserImage(userId: UserId) {
	await fetch("/updateUser", {
		method: "POST",
		body: JSON.stringify({
			id: userId,
			image: BLANK_CHARACTER
		} satisfies UpdateUserInput)
	});
}

export type UserAccount = { providerId: ProviderId; name: string; email: string; image: string };
export async function setAccountDetails(userId: UserId, account: UserAccount) {
	await fetch("/updateUser", {
		method: "POST",
		body: JSON.stringify({
			id: userId,
			...account
		} satisfies UpdateUserInput)
	});
}

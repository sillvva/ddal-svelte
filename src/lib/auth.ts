import type { Passkey } from "#lib/server/db/schema.js";
import { PUBLIC_URL } from "$app/env/public";
import { passkeyClient } from "@better-auth/passkey/client";
import { adminClient, lastLoginMethodClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/svelte";

export const authClient = createAuthClient({
	baseURL: PUBLIC_URL,
	plugins: [passkeyClient(), adminClient(), lastLoginMethodClient()]
});

export function authName(passkey: Passkey) {
	return passkey.name || passkey.id.replace(/[^a-z0-9]/gi, "").slice(-8);
}

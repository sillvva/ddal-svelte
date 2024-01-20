import type { Account } from "@prisma/client";
import { redirect } from "@sveltejs/kit";

/**
 * Redirects to /sign-in with a redirect query parameter
 * @param url - The URL to redirect to after signing in
 * @throws {Redirect} Redirects to /sign-in
 * @return {never}
 */
export function signInRedirect(url: URL): never {
	// redirect(302, `/sign-in?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
	redirect(302, `/?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
}

type Provider = {
	name: string;
	id: string;
	logo?: string;
	account?: Account;
};
export const providers = [
	{
		name: "Google",
		id: "google",
		logo: "/images/google.svg"
	},
	{
		name: "Discord",
		id: "discord",
		logo: "/images/discord.svg"
	}
] as const satisfies Provider[];

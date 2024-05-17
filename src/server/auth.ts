import type { Prettify } from "$lib/util";
import { AuthError, type User } from "@auth/sveltekit";
import { redirect } from "@sveltejs/kit";

function urlRedirect(url: URL) {
	return `redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`;
}

/**
 * Redirects to / with a redirect query parameter
 * @param url - The URL to redirect to after signing in
 * @throws {Redirect} Redirects to /sign-in
 * @return {never}
 */
export function signInRedirect(url: URL): never {
	redirect(302, `/?${urlRedirect(url)}`);
}

type ErrorType = InstanceType<typeof AuthError>["type"];

export type ErrorCodes =
	| "NotAuthenticated"
	| "MissingUserData"
	| "MissingAccountData"
	| "MissingProfileData"
	| "InvalidProvider"
	| "ProfileNotFound"
	| "SignupsDisabled"
	| "ExistingAccount"
	| "UnknownError"
	| ErrorType;

/**
 * Redirects to / with a code and message query parameter
 * @param code - The error code
 * @param message - The error message
 * @param redirectTo - The URL to redirect to after signing in
 * @throws {Redirect} Redirects to /
 * @return {string} The redirect URL
 */
export function authErrRedirect(
	code: ErrorCodes,
	options?: URL | string | Partial<{ detail: string; redirectTo: string | URL }>
) {
	if (!options) options = {};
	if (typeof options === "string") options = { detail: options };
	if (options instanceof URL) options = { redirectTo: options };
	const redirectUrl = options.redirectTo && new URL(options.redirectTo);
	return (
		`/?error=${code}` + (options.detail ? `&detail=${options.detail}` : "") + (redirectUrl ? `&${urlRedirect(redirectUrl)}` : "")
	);
}

export function assertUser<T extends User>(
	user: T | undefined,
	redirectUrl: URL
): asserts user is Prettify<T & LocalsSession["user"]> {
	if (!user) redirect(302, `/?${urlRedirect(redirectUrl)}`);
	if (!user.id || !user.name || !user.email) redirect(302, authErrRedirect("MissingUserData", redirectUrl));
}

export function authErrors(code: ErrorCodes, detail?: string | null) {
	if (!detail) detail = null;
	switch (code) {
		case "InvalidProvider":
			return detail && `${detail} is not supported`;
		case "OAuthAccountNotLinked":
			return `You have not linked this provider to your account. Sign in and link additional providers in the settings menu.`;
		case "ExistingAccount":
			return detail && `You already have an account with ${detail}. Sign in and link additional providers in the settings menu.`;
		default:
			return null;
	}
}

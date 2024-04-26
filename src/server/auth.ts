import type { Prettify } from "$lib/util";
import type { AdapterUser } from "@auth/core/adapters";
import { AuthError, type User } from "@auth/sveltekit";
import { redirect } from "@sveltejs/kit";

/**
 * Redirects to / with a redirect query parameter
 * @param url - The URL to redirect to after signing in
 * @throws {Redirect} Redirects to /sign-in
 * @return {never}
 */
export function signInRedirect(url: URL): never {
	redirect(302, `/?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
}

type ErrorType = typeof AuthError.prototype.type;

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
		`/?error=${code}` +
		(options.detail ? `&detail=${options.detail}` : "") +
		(redirectUrl ? `&redirect=${encodeURIComponent(`${redirectUrl.pathname}${redirectUrl.search}`)}` : "")
	);
}

export function assertUser<T extends User | AdapterUser>(
	user: T | undefined,
	redirectUrl?: URL
): asserts user is Prettify<T & LocalsSession["user"]> {
	try {
		if (!user) throw "NotAuthenticated";
		if (!user.id || !user.name) throw "MissingUserData";
	} catch (error) {
		const err = error as ErrorCodes;
		if (redirectUrl) {
			if (err === "NotAuthenticated")
				redirect(302, `/?redirect=${encodeURIComponent(`${redirectUrl.pathname}${redirectUrl.search}`)}`);
			redirect(302, authErrRedirect(err, redirectUrl));
		} else throw error;
	}
}

export function authErrors(code: ErrorCodes, detail?: string | null) {
	if (!detail) detail = null;
	switch (code) {
		case "InvalidProvider":
			return detail && `${detail} is not supported`;
		case "ExistingAccount":
			return (
				detail && `You already have an account with ${detail}. Sign in, then link additional providers in the settings menu.`
			);
		default:
			return null;
	}
}

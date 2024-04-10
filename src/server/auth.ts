import type { UserId } from "$lib/schemas";
import type { AdapterUser } from "@auth/core/adapters";
import type { User } from "@auth/sveltekit";
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

/**
 * Redirects to /auth/err with a code and message query parameter
 * @param code - The error code
 * @param message - The error message
 * @param redirectTo - The URL to redirect to after signing in
 * @throws {Redirect} Redirects to /auth/err
 * @return {never}
 */
export function authErrRedirect(code: number | string, message: string, redirectTo?: URL): never {
	redirect(
		302,
		`/?code=${code}&message=${message}` +
			(redirectTo ? `&redirect=${encodeURIComponent(`${redirectTo.pathname}${redirectTo.search}`)}` : "")
	);
}

export function assertUser(user: User | AdapterUser): asserts user is AdapterUser & { id: UserId; name: string } {
	if (!user?.id || !user.name) throw new Error("Not authenticated");
}

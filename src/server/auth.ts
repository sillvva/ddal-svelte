import type { UserId } from "$lib/schemas";
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

/**
 * Redirects to / with a code and message query parameter
 * @param code - The error code
 * @param message - The error message
 * @param redirectTo - The URL to redirect to after signing in
 * @throws {Redirect} Redirects to /
 * @return {never}
 */
export function authErrRedirect(code: number | string, message: string, redirectTo?: URL): never {
	redirect(
		302,
		`/?code=${code}&message=${message}` +
			(redirectTo ? `&redirect=${encodeURIComponent(`${redirectTo.pathname}${redirectTo.search}`)}` : "")
	);
}

export function assertUser<T extends User | AdapterUser>(
	user: T | undefined,
	redirectTo?: URL
): asserts user is T & { id: UserId; name: string } {
	try {
		if (!user) throw new Error("Not authenticated");
		if (!user.id || !user.name) throw new AuthError("Missing user id or name");
	} catch (error) {
		if (error instanceof AuthError) {
			authErrRedirect(error.type || "Auth Error", error.message.split(" Read")[0]!, redirectTo);
		} else {
			signInRedirect(redirectTo || new URL("/"));
		}
	}
}

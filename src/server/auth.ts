import { redirect } from "@sveltejs/kit";

/**
 * Redirects to /sign-in with a redirect query parameter
 * @param url - The URL to redirect to after signing in
 * @throws {Redirect} Redirects to /sign-in
 */
export function signInRedirect(url: URL) {
	redirect(302, `/sign-in?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
}

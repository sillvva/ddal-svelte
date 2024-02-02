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
 * @param code
 * @param message
 * @throws {Redirect} Redirects to /auth/err
 * @return {never}
 */
export function authErrRedirect(code: number | string, message: string): never {
	redirect(302, `/auth/err?code=${code}&message=${message}`);
}

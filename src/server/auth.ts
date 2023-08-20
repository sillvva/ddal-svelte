import { redirect } from "@sveltejs/kit";

export function signInRedirect(url: URL) {
	return redirect(301, `/sign-in?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
}

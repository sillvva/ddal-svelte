import { dev } from "$app/environment";
import { getRequestEvent } from "$app/server";
import { PROVIDERS } from "$lib/constants";
import { localsUserSchema, type LocalsUser, type UserId } from "$lib/schemas";
import { redirect } from "@sveltejs/kit";
import { Effect } from "effect";
import * as v from "valibot";
import { DBService, FetchError } from "./db/effect";

export function assertUser(user: LocalsUser | undefined): asserts user is LocalsUser {
	const url = getRequestEvent().url;
	const result = v.safeParse(localsUserSchema, user);
	if (!result.success) {
		if (dev) console.error("assertUser", v.summarize(result.issues));
		redirect(302, `/?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
	}
}

class FetchUserError extends FetchError {}
function createFetchUserError(err: unknown): FetchUserError {
	return FetchUserError.from(err);
}

export function getLocalsUser(userId: UserId) {
	return Effect.gen(function* () {
		const Database = yield* DBService;
		const db = yield* Database.db;

		return yield* Effect.tryPromise({
			try: () =>
				db.query.user.findFirst({
					with: {
						accounts: {
							columns: {
								id: true,
								accountId: true,
								providerId: true,
								scope: true,
								createdAt: true,
								updatedAt: true
							},
							where: {
								providerId: {
									in: PROVIDERS.map((p) => p.id)
								}
							}
						},
						passkeys: {
							columns: {
								id: true,
								name: true,
								createdAt: true
							}
						}
					},
					where: {
						id: {
							eq: userId
						}
					}
				}),
			catch: createFetchUserError
		});
	});
}

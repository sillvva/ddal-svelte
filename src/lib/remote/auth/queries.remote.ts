import { guardedQuery } from "#lib/server/effect/guarded.js";
import { AuthService } from "#lib/server/effect/services/auth.js";

export const getAccounts = guardedQuery(function* () {
	const Auth = yield* AuthService;
	return yield* Auth.getAccounts();
});

/** Sends unfinished passkey signups to onboarding and everyone else through the normal auth guard. */
export const requireOnboarded = guardedQuery(function* () {
	return true;
});

export const onboarding = guardedQuery(function* () {
	return true;
}, "onboarding");
